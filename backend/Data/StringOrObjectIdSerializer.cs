// ============================================================================
// File: StringOrObjectIdSerializer.cs
// Project: Solvance — Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Course: SE4040 - Enterprise Application Development (SLIIT)
// Description: Custom BSON serializer deserializing both BsonType.ObjectId and BsonType.String to C# string.
// References & Citations:
//   - MongoDB.Bson.Serialization.Serializers API:
//     https://www.mongodb.com/docs/drivers/csharp/current/fundamentals/serialization/
// ============================================================================

using System;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Bson.Serialization.Serializers;

namespace SolarMicrogridApi.Data
{
    /// <summary>
    /// Custom serializer allowing string properties to seamlessly deserialize from either BSON ObjectId or BSON String.
    /// </summary>
    public class StringOrObjectIdSerializer : SerializerBase<string>
    {
        public override string Deserialize(BsonDeserializationContext context, BsonDeserializationArgs args)
        {
            // Method: Deserialize - Deserializes BSON ObjectId or String into a C# string.
            var bsonType = context.Reader.CurrentBsonType;
            if (bsonType == BsonType.ObjectId)
            {
                return context.Reader.ReadObjectId().ToString();
            }
            if (bsonType == BsonType.String)
            {
                return context.Reader.ReadString();
            }
            if (bsonType == BsonType.Null)
            {
                context.Reader.ReadNull();
                return string.Empty;
            }

            context.Reader.SkipValue();
            return string.Empty;
        }

        public override void Serialize(BsonSerializationContext context, BsonSerializationArgs args, string value)
        {
            // Method: Serialize - Writes C# string value to BSON writer.
            if (string.IsNullOrEmpty(value))
            {
                context.Writer.WriteString(string.Empty);
            }
            else
            {
                context.Writer.WriteString(value);
            }
        }
    }
}
