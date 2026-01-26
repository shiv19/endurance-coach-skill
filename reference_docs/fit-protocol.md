# FIT Protocol Summary

Source: [Garmin FIT Protocol](https://developer.garmin.com/fit/protocol/)

Key ideas

- FIT is a compact, interoperable binary format for sport/fitness data. Files are built from a fixed structure: header, data records, CRC.
- A FIT file is a sequence of definition messages followed by data messages. Definitions map local message types to global FIT messages and their field layouts.
- Devices can ignore unknown messages/fields and fill missing values with invalid defaults to maintain compatibility.
- The global profile defines all FIT messages, fields, and data types; product profiles choose subsets.
- The protocol supports dynamic fields and subfields where interpretation depends on a reference field value.
- Best practices: include File ID first, define each data message before use, minimize local message types, and group messages by type when possible.

File structure essentials

- Header: includes protocol/profile versions, data size, and “.FIT” signature; 14-byte header preferred.
- Data records: each record has a header indicating definition vs data and local message type.
- CRC: 2-byte checksum at end; header CRC optional if 14-byte header used.

Compatibility and extensibility

- New messages can be added in manufacturer-specific ranges; unknown fields are ignored by decoders.
- FIT SDK handles endianness and version differences; invalid fields are set to default invalid values.

Implementation notes

- Always emit a File ID message before any other data.
- Ensure each data message has a prior definition message with matching local message type.
- Dynamic fields and subfields are common; refer to Profile.xlsx in the SDK for exact field mappings.
