import json
import os
import time
import boto3
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

s3 = boto3.client('s3')
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.getenv('TABLE_NAME'))
dst_bucket_name = os.getenv('DST_BUCKET_NAME')
DISOWNED_THRESHOLD = 10  # seconds

def handler(event, context):
    try:
        # Current time to compare against disown timestamps
        current_time = int(time.time())
        
        # Query the DynamoDB table using GSI to find disowned objects
        response = table.query(
            IndexName='DisownIndex',
            KeyConditionExpression=Key('DisownStatus').eq(b'\x01') & Key('DisownTimestamp').lt(current_time - DISOWNED_THRESHOLD)
        )
        
        disowned_items = response.get('Items', [])
        for item in disowned_items:
            # Delete the object from Destination Bucket
            s3.delete_object(Bucket=dst_bucket_name, Key=item['CopyID'])

            # Delete the entry from DynamoDB
            table.delete_item(
                Key={'ObjectID': item['ObjectID'], 'CopyID': item['CopyID']}
            )
        
        return {
            'statusCode': 200,
            'body': json.dumps('Cleanup completed successfully')
        }

    except ClientError as e:
        print(f"Error during cleanup process: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps('Cleanup encountered an error')
        }
