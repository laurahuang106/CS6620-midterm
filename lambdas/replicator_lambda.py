import os
import boto3
import time
from botocore.exceptions import ClientError

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.getenv('TABLE_NAME'))
dst_bucket_name = os.getenv('DST_BUCKET_NAME')

def handler(event, context):
    try:
        for record in event['Records']:
            src_bucket_name = record['s3']['bucket']['name']
            object_key = record['s3']['object']['key']
            event_name = record['eventName']

            if 'ObjectCreated' in event_name:
                handle_put_event(src_bucket_name, object_key)
            elif 'ObjectRemoved' in event_name:
                handle_delete_event(object_key)

    except ClientError as e:
        print(f"Error: {e}")

def handle_put_event(src_bucket_name, object_key):
    timestamp = int(time.time())
    copy_key = f"{object_key}-{timestamp}"

    # Copy the object to Destination Bucket
    s3.copy_object(
        CopySource={'Bucket': src_bucket_name, 'Key': object_key},
        Bucket=dst_bucket_name,
        Key=copy_key
    )

    # Query for existing copies in the DynamoDB table
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('ObjectID').eq(object_key)
    )
    items = response.get('Items', [])

    # If there is more than one existing copy, delete the oldest copy from Bucket Dst
    if len(items) > 0:
        # Sort by CopyID (assuming CopyID has a timestamp suffix), and find the oldest
        oldest_copy = sorted(items, key=lambda x: x['CopyID'])[0]
        oldest_copy_key = oldest_copy['CopyID']

        # Delete the oldest copy from Bucket Dst
        s3.delete_object(Bucket=dst_bucket_name, Key=oldest_copy_key)
        
        # Remove the entry of the oldest copy from DynamoDB Table T
        table.delete_item(
            Key={'ObjectID': object_key, 'CopyID': oldest_copy_key}
        )

    # Add the new copy to the DynamoDB table
    table.put_item(
        Item={
            'ObjectID': object_key,
            'CopyID': copy_key,
            'DisownStatus': 0,  # 0 for owned
            'DisownTimestamp': timestamp  # Real timestamp of creation/update
        }
    )

def handle_delete_event(object_key):
    # Mark the object as disowned in the DynamoDB table
    response = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key('ObjectID').eq(object_key)
    )
    for item in response.get('Items', []):
        table.update_item(
            Key={'ObjectID': item['ObjectID'], 'CopyID': item['CopyID']},
            UpdateExpression="SET DisownStatus = :status, DisownTimestamp = :timestamp",
            ExpressionAttributeValues={
                ':status': 1,  # 1 for disowned
                ':timestamp': int(time.time())
            }
        )
