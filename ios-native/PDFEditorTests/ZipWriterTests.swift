import XCTest
@testable import PDFEditor

final class ZipWriterTests: XCTestCase {
    func testChecksumMatchesTheReferenceValue() {
        XCTAssertEqual(CRC32.checksum(Data("123456789".utf8)), 0xCBF4_3926)
    }

    func testChecksumOfEmptyDataIsZero() {
        XCTAssertEqual(CRC32.checksum(Data()), 0)
    }

    func testArchiveStartsWithLocalHeaderAndEndsWithDirectoryRecord() {
        var zip = ZipWriter()
        zip.add(name: "a.txt", content: Data("alpha".utf8))
        zip.add(name: "dir/b.txt", content: Data("beta".utf8))
        let archive = [UInt8](zip.finalize())

        XCTAssertEqual(Array(archive.prefix(4)), [0x50, 0x4B, 0x03, 0x04])
        let end = Array(archive.suffix(22))
        XCTAssertEqual(Array(end.prefix(4)), [0x50, 0x4B, 0x05, 0x06])
        XCTAssertEqual(end[8], 2)
        XCTAssertEqual(end[10], 2)
    }

    func testStoredEntryKeepsItsBytes() {
        var zip = ZipWriter()
        zip.add(name: "a.txt", content: Data("alpha".utf8))
        let archive = zip.finalize()
        let payload = archive.subdata(in: 35..<40)
        XCTAssertEqual(String(decoding: payload, as: UTF8.self), "alpha")
    }
}
