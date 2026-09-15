// ============================================================================
// File: StringOrObjectIdSerializer.cs
// Project: Smart Solar Microgrid Trading System
// Author: Enterprise Application Development Team
// Description: Custom BSON serializer deserializing both BsonType.ObjectId and BsonType.String to C# string.
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
