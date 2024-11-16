import os
import boto3
import time
import urllib.parse
from botocore.exceptions import ClientError

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.getenv('TABLE_NAME'))
dst_bucket_name = os.getenv('DST_BUCKET_NAME')

def handler(event, context):
    try:
        for record in event['Records']:
            src_bucket_name = record['s3']['bucket']['name']
            encoded_key = record['s3']['object']['key']
            object_key = urllib.parse.unquote_plus(encoded_key)  # Decode URL-encoded key
            event_name = record['eventName']

            if 'ObjectCreated' in event_name:
                handle_put_event(src_bucket_name, object_key)
            elif 'ObjectRemoved' in event_name:
                handle_delete_event(object_key)

    except ClientError as e:
        print(f"Error in Lambda handler: {e}")

def handle_put_event(src_bucket_name, object_key):
    timestamp = int(time.time())
    copy_key = f"{object_key}-{timestamp}"

    # Check if the object exists in the source bucket
    try:
        s3.head_object(Bucket=src_bucket_name, Key=object_key)
    except ClientError as e:
        if e.response['Error']['Code'] == "404":
            print(f"Object {object_key} not found in {src_bucket_name}. Skipping copy.")
            return
        else:
            print(f"Error checking object {object_key}: {e}")
            raise

    # Copy the object to the destination bucket
    try:
        s3.copy_object(
            CopySource={'Bucket': src_bucket_name, 'Key': object_key},
            Bucket=dst_bucket_name,
            Key=copy_key
        )
        print(f"Successfully copied {object_key} to {dst_bucket_name}/{copy_key}")
    except ClientError as e:
        print(f"Error copying {object_key} to {dst_bucket_name}: {e}")
        return

    # Query for existing copies in DynamoDB
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('ObjectID').eq(object_key)
    )
    items = response.get('Items', [])

    # If more than one copy exists, delete the oldest copy in Bucket Dst
    if len(items) > 0:
        oldest_copy = sorted(items, key=lambda x: x['DisownTimestamp'])[0]
        oldest_copy_key = oldest_copy['CopyID']

        # Delete the oldest copy from Bucket Dst and DynamoDB
        try:
            s3.delete_object(Bucket=dst_bucket_name, Key=oldest_copy_key)
            table.delete_item(Key={'ObjectID': object_key, 'CopyID': oldest_copy_key})
            print(f"Deleted oldest copy: {oldest_copy_key} from {dst_bucket_name}")
        except ClientError as e:
            print(f"Error deleting oldest copy {oldest_copy_key}: {e}")

    # Add the new copy to the DynamoDB table
    table.put_item(
        Item={
            'ObjectID': object_key,
            'CopyID': copy_key,
            'DisownStatus': b'\x00',  # 0 for owned
            'DisownTimestamp': timestamp
        }
    )

def handle_delete_event(object_key):
    # Mark the object as disowned in the DynamoDB table
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('ObjectID').eq(object_key)
    )
    for item in response.get('Items', []):
        try:
            table.update_item(
                Key={'ObjectID': item['ObjectID'], 'CopyID': item['CopyID']},
                UpdateExpression="SET DisownStatus = :status, DisownTimestamp = :timestamp",
                ExpressionAttributeValues={
                    ':status': b'\x01',  # 1 for disowned
                    ':timestamp': int(time.time())
                }
            )
            print(f"Marked {item['CopyID']} as disowned in DynamoDB.")
        except ClientError as e:
            print(f"Error marking {item['CopyID']} as disowned: {e}")
