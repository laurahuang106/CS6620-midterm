import * as cdk from 'aws-cdk-lib';
import { DynamoDBStack } from '../lib/dynamodb-stack';
import { S3ReplicatorStack } from '../lib/s3-replicator-stack';
import { CleanerLambdaStack } from '../lib/cleaner-lambda-stack';

const app = new cdk.App();

const dynamoDBStack = new DynamoDBStack(app, 'DynamoDBStack');

const s3ReplicatorStack = new S3ReplicatorStack(app, 'S3ReplicatorStack', {
  table: dynamoDBStack.table, 
});

new CleanerLambdaStack(app, 'CleanerLambdaStack', {
  dstBucket: s3ReplicatorStack.dstBucket,  
  table: dynamoDBStack.table,              
});
