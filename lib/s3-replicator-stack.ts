import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import { LambdaDestination } from 'aws-cdk-lib/aws-s3-notifications';

interface S3ReplicatorStackProps extends cdk.StackProps {
  table: dynamodb.Table;
}

export class S3ReplicatorStack extends cdk.Stack {
  public readonly srcBucket: s3.Bucket;
  public readonly dstBucket: s3.Bucket;
  public readonly replicatorFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: S3ReplicatorStackProps) {
    super(scope, id, props);

    // Define Source Bucket
    this.srcBucket = new s3.Bucket(this, 'SourceBucket', {
      bucketName: 'laura-assignment4-cdk-source-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true, // Automatically delete all objects before the bucket itself is deleted
    });

    // Define Destination Bucket
    this.dstBucket = new s3.Bucket(this, 'DestinationBucket', {
      bucketName: 'laura-assignment4-cdk-destination-bucket',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Define the Replicator Lambda Function
    this.replicatorFunction = new lambda.Function(this, 'ReplicatorLambda', {
      functionName: 'ReplicatorLambda',
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'replicator_lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas')),
      environment: {
        DST_BUCKET_NAME: this.dstBucket.bucketName,
        TABLE_NAME: props.table.tableName,
      },
      timeout: cdk.Duration.minutes(5),
    });

    // Grant permissions to the Replicator Lambda
    this.replicatorFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: ['s3:*', 'dynamodb:*'],
      effect: iam.Effect.ALLOW,
      resources: [
        this.srcBucket.bucketArn,
        this.srcBucket.bucketArn + '/*',
        this.dstBucket.bucketArn,
        this.dstBucket.bucketArn + '/*',
        props.table.tableArn,
        props.table.tableArn + '/*',
      ],
    }));

    // Add S3 event notifications for Replicator Lambda
    this.srcBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new LambdaDestination(this.replicatorFunction)
    );

    this.srcBucket.addEventNotification(
      s3.EventType.OBJECT_REMOVED_DELETE,
      new LambdaDestination(this.replicatorFunction)
    );

    // Output the Lambda ARN for reference
    new cdk.CfnOutput(this, 'ReplicatorLambdaArn', {
      value: this.replicatorFunction.functionArn,
      exportName: 'ReplicatorLambdaArn',
    });
  }
}
