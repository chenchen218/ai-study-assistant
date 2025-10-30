import AWS from "aws-sdk";
import { v4 as uuidv4 } from "uuid";

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
});

const BUCKET_NAME =
  process.env.AWS_S3_BUCKET_NAME || "ai-study-assistant-documents";

export async function uploadToS3(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = `documents/${uuidv4()}-${fileName}`;

  const params: AWS.S3.PutObjectRequest = {
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: contentType,
    ACL: "private",
  };

  await s3.putObject(params).promise();

  const url = s3.getSignedUrl("getObject", {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: 3600 * 24 * 7, // 7 days
  });

  return { key, url };
}

export async function getFileFromS3(key: string): Promise<Buffer> {
  const params: AWS.S3.GetObjectRequest = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  const data = await s3.getObject(params).promise();
  return data.Body as Buffer;
}

export async function deleteFromS3(key: string): Promise<void> {
  const params: AWS.S3.DeleteObjectRequest = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  await s3.deleteObject(params).promise();
}
