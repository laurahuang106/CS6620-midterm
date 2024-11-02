import * as cdk from 'aws-cdk-lib';
import { StorageStack } from '../lib/storage-stack';
import { ReplicatorLambdaStack } from '../lib/replicator-lambda-stack';
import { CleanerLambdaStack } from '../lib/cleaner-lambda-stack';

const app = new cdk.App();

const storageStack = new StorageStack(app, 'StorageStack');

new ReplicatorLambdaStack(app, 'ReplicatorLambdaStack', {
  srcBucket: storageStack.srcBucket,
  dstBucket: storageStack.dstBucket,
  table: storageStack.table
});

new CleanerLambdaStack(app, 'CleanerLambdaStack', {
  dstBucket: storageStack.dstBucket,
  table: storageStack.table
});
