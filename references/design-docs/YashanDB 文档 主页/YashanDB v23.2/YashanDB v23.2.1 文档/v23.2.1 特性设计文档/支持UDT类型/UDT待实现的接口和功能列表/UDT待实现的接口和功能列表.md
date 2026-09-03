Created by 方少奎, last modified by  张周玺 on 十一月 27, 2023

# 待实现接口整理

|单号|描述|
|---|---|
|YDBRD-20704|支持java.sql.Connection接口的特定方法   ,createStruct(String typeName, Object[] attributes)   ,Array createArray(String typeName, Object[] elements)   ,Array createArrayOf(String typeName, Object[] elements)|
|YDBRD-20705|支持java.sql.PreparedStatement接口的特定方法   ,setArray(int parameterIndex,Array x)   ,***TODO:***  *** ***  setNull(int parameterIndex,int sqlType,String typeName) -- 不带typeName已实现|
|YDBRD-22257|支持java.sql.SQLInput接口的特定方法   ,readString()   ,readBoolean()   ,readByte()   ,readShort()   ,readInt()   ,readLong()   ,readFloat()   ,readDouble()   ,readBigDecimal()   ,readBytes()   ,readDate()   ,readTime()   ,readTimestamp()   ,***TODO:***  *** ***  readCharacterStream()) ,   ***TODO:***  *** ***  readAsciiStream()) ,   ***TODO:***  *** ***  readBinaryStream()) ,   readObject()) ,   ***TODO:***  *** ***  readBlob()) ,   ***T***  ***ODO:***  *** ***  readClob()) ,   ***TODO:***  *** ***  readArray()) ,   ***TODO:***  *** ***  wasNull()   ,***TODO:***  *** ***  readNString()) ,   readRowId()   ,r  eadObject(Class  <T>   type)|
|YDBRD-20717|支持ResultSet接口的特定方法   ,getObject(int columnIndex, java.util.Map<String,Class<?>> map)   ,getObject(String columnLabel, java.util.Map<String, Class<?>> map)   ,getArray(int columnIndex)     getArray(String columnLabel)|
|YDBRD-22248|***TODO ALL:***  *** ***  支持java.sql.SQLOutput接口的特定方法   ,writeString(String x)   ,writeBoolean(boolean x)   ,writeByte(byte x)   ,writeShort(short x)   ,writeInt(int x),writeLong(long x)   ,writeFloat(float x)   ,writeDouble(double x)   ,writeBigDecimal(BigDecimal x)   ,writeBytes(byte[] x)   ,writeDate(Date x)   ,writeTime(Time x)   ,writeTimestamp(Timestamp x)   ,writeCharacterStream(Reader x)   ,writeAsciiStream(InputStream x)   ,writeBinaryStream(InputStream x)   ,writeObject(SQLData x)   ,writeBlob(Blob x)   ,writeClob(Clob x)   ,writeStruct(Struct x)   ,writeArray(Array x)   ,writeRowId(RowId x)   ,writeObject(Object x,SQLType targetSqlType)|
|YDBRD-20719|支持java.sql.CallableStatement接口的特定方法   ,***TODO:***  *** ***  getArray (int parameterIndex)   ,***TODO:***  *** ***  registerOutParameter (int parameterIndex, SQLType sqlType, String typeName)   ,***TODO:***  *** ***  registerOutParameter (int parameterIndex, int sqlType, String typeName)   ,***TODO:***  *** ***  registerOutParameter(int parameterIndex, SQLType sqlType)|


# 后续优化项：

1、传输协议，最大使用2byte来表示大小，很明显不够，后续需要改成stream协议来传输