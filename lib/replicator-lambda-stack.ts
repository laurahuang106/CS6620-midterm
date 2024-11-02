import * as cdk from 'aws-cdk-lib';
import { Stack, StackProps } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import path = require('path');

export interface ReplicatorLambdaStackProps extends StackProps {
  srcBucket: s3.Bucket;
  dstBucket: s3.Bucket;
  table: dynamodb.Table;
}

export class ReplicatorLambdaStack extends Stack {
  public readonly replicatorFunction: lambda.Function;

  constructor(scope: cdk.App, id: string, props: ReplicatorLambdaStackProps) {
    super(scope, id, props);

    this.replicatorFunction = new lambda.Function(this, 'ReplicatorLambda', {
      functionName: 'ReplicatorLambda',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'replicator_lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
      environment: {
        DST_BUCKET_NAME: props.dstBucket.bucketName,
        TABLE_NAME: props.table.tableName
      }
    });

    // Grant necessary permissions
    props.srcBucket.grantRead(this.replicatorFunction);
    props.dstBucket.grantReadWrite(this.replicatorFunction);
    props.table.grantReadWriteData(this.replicatorFunction);
  }
}
