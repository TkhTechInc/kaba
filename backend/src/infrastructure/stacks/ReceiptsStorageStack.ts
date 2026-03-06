/**
 * ReceiptsStorageStack - S3 bucket for receipt image storage with CloudFront CDN
 */
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { EnvironmentConfig } from '../config/environments';

export interface ReceiptsStorageStackProps extends cdk.StackProps {
  environment: string;
  config: EnvironmentConfig;
}

export class ReceiptsStorageStack extends cdk.Stack {
  public readonly receiptsBucket: s3.Bucket;
  public readonly receiptsDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: ReceiptsStorageStackProps) {
    super(scope, id, props);

    const { environment } = props;

    this.receiptsBucket = new s3.Bucket(this, 'ReceiptsBucket', {
      removalPolicy: environment === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
    });

    this.receiptsDistribution = new cloudfront.Distribution(this, 'ReceiptsDistribution', {
      comment: `Receipts CDN for Kaba ${environment}`,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessIdentity(this.receiptsBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
    });

    new cdk.CfnOutput(this, 'ReceiptsBucketName', {
      value: this.receiptsBucket.bucketName,
      description: 'S3 bucket for receipt image storage',
      exportName: `Kaba-${environment}-ReceiptsBucketName`,
    });

    new cdk.CfnOutput(this, 'ReceiptsDistributionDomainName', {
      value: this.receiptsDistribution.distributionDomainName,
      description: 'CloudFront distribution domain name for receipts CDN',
      exportName: `Kaba-${environment}-ReceiptsDistributionDomainName`,
    });

    new cdk.CfnOutput(this, 'ReceiptsDistributionUrl', {
      value: `https://${this.receiptsDistribution.distributionDomainName}`,
      description: 'CloudFront distribution URL for receipts CDN (use with signed URLs for private content)',
      exportName: `Kaba-${environment}-ReceiptsDistributionUrl`,
    });
  }
}
