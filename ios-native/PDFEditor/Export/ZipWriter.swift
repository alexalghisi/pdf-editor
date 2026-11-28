import Foundation

enum CRC32 {
    private static let table: [UInt32] = (0..<256).map { index -> UInt32 in
        var value = UInt32(index)
        for _ in 0..<8 {
            value = (value & 1) == 1 ? (0xEDB8_8320 ^ (value >> 1)) : (value >> 1)
        }
        return value
    }

    static func checksum(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xFFFF_FFFF
        for byte in data {
            crc = table[Int((crc ^ UInt32(byte)) & 0xFF)] ^ (crc >> 8)
        }
        return crc ^ 0xFFFF_FFFF
    }
}

struct ZipWriter {
    private struct Entry {
        let name: Data
        let crc: UInt32
        let size: UInt32
        let offset: UInt32
    }

    private var body = Data()
    private var entries: [Entry] = []

    mutating func add(name: String, content: Data) {
        let nameData = Data(name.utf8)
        let entry = Entry(
            name: nameData,
            crc: CRC32.checksum(content),
            size: UInt32(content.count),
            offset: UInt32(body.count)
        )
        body.appendLE(UInt32(0x0403_4B50))
        body.appendLE(UInt16(20))
        body.appendLE(UInt16(0x0800))
        body.appendLE(UInt16(0))
        body.appendLE(UInt16(0))
        body.appendLE(UInt16(0x0021))
        body.appendLE(entry.crc)
        body.appendLE(entry.size)
        body.appendLE(entry.size)
        body.appendLE(UInt16(nameData.count))
        body.appendLE(UInt16(0))
        body.append(nameData)
        body.append(content)
        entries.append(entry)
    }

    func finalize() -> Data {
        var archive = body
        let directoryOffset = UInt32(archive.count)
        for entry in entries {
            archive.appendLE(UInt32(0x0201_4B50))
            archive.appendLE(UInt16(20))
            archive.appendLE(UInt16(20))
            archive.appendLE(UInt16(0x0800))
            archive.appendLE(UInt16(0))
            archive.appendLE(UInt16(0))
            archive.appendLE(UInt16(0x0021))
            archive.appendLE(entry.crc)
            archive.appendLE(entry.size)
            archive.appendLE(entry.size)
            archive.appendLE(UInt16(entry.name.count))
            archive.appendLE(UInt16(0))
            archive.appendLE(UInt16(0))
            archive.appendLE(UInt16(0))
            archive.appendLE(UInt16(0))
            archive.appendLE(UInt32(0))
            archive.appendLE(entry.offset)
            archive.append(entry.name)
        }
        let directorySize = UInt32(archive.count) - directoryOffset
        archive.appendLE(UInt32(0x0605_4B50))
        archive.appendLE(UInt16(0))
        archive.appendLE(UInt16(0))
        archive.appendLE(UInt16(entries.count))
        archive.appendLE(UInt16(entries.count))
        archive.appendLE(directorySize)
        archive.appendLE(directoryOffset)
        archive.appendLE(UInt16(0))
        return archive
    }
}

extension Data {
    mutating func appendLE(_ value: UInt16) {
        append(UInt8(value & 0xFF))
        append(UInt8((value >> 8) & 0xFF))
    }

    mutating func appendLE(_ value: UInt32) {
        append(UInt8(value & 0xFF))
        append(UInt8((value >> 8) & 0xFF))
        append(UInt8((value >> 16) & 0xFF))
        append(UInt8((value >> 24) & 0xFF))
    }
}
