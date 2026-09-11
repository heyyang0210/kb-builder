Created by 郑思远, last modified on 八月 09, 2023

# 1.   **概述**

本文描述JDBC支持JSON数据类型编解码、索引等接口

# 2.   **需求分析**

  [YDBRD-13079](https://jira.yasdb.com/browse/YDBRD-13079?src=confmacro)    **-**  **【驱动】JDBC支持JSON数据类型编解码、索引等接口**  **完成**

设计文档  **：**    [JDBC支持JSON数据类型增强 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=113975543)  

1、读取、创建和修改JSON类型值。

2、以数据库使用的相同二进制JSON存储格式对JSON类型值进行编码/解码。

3、将JSON类型值转换为JSON文本和从JSON文本转换JSON类型值。

4、  使用json三方件还是按标准json去处理，崖山扩展类型在json三方件中表现为数字或string。

5、服务端YASON支持的扩展类型

|类型|编码|长度|说明|
|---|---|---|---|
|tinyint|07|1字节|8位有符号整数|
|smallint|08|2字节|16位有符号整数|
|integer|09|4字节|32位有符号整数|
|bigint|10|8字节|64位有符号整数|
|float|11|4字节|32位浮点数|
|double|12|8字节|64位浮点数|
|binary|13|变长|二进制数据|
|timestamp|14|8字节|时间戳|
|date|15|8字节|日期类型，可包含时分秒|
|time|16|8字节|时间，只有时分秒|


6.新加接口与方法

|yasdb jdbc接口|yasdb jdbc方法|ojdbc11接口|ojdbc11方法|例程|备注|
|---|---|---|---|---|---|
|YasonValue|getType();    
  getDepth();    
  getString();    
  equals();|OracleJsonValue|  
|  
|  
|
|YasonObject|get(1);    
  get(1,null);    
  getShort();    
  getShort("1");    
  getShort("1", (short)1);    
  getInt();    
  getInt("1");    
  getInt("1", 1);    
  getLong();    
  getLong("1");    
  getLong("1", 1);    
  getBigDecimal();    
  getBigDecimal("1");    
  getBigDecimal("1",new BigDecimal    
  getFloat();    
  getFloat("1");    
  getFloat("1", 1);    
  getDouble();    
  getDouble("1");    
  getDouble("1",1);    
  getString();    
  getString("1");    
  getString("1", "1");    
  getBoolean("1");    
  getBoolean("1", true);    
  getByte();    
  getByte("1");    
  getByte("1", (byte) 1);    
  getBytes("1");    
  getBytes("1", null);    
  getDate("1");    
  getDate("1", null);    
  getLocalDate("1");    
  getLocalDateTime("1", null);    
  getLocalTime("1");    
  getTimeStamp("1", null);    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();    
  getValue();    
  getDepth();    
  getDepth(1);    
  getOrDefault(1, null);    
  getType();    
  getClass();    
  getBinaryData();    
  size();    
  isEmpty();    
  containsKey("1");    
  containsValue("1");    
  remove("1");    
  remove("1","1");    
  clear();    
  keySet();    
  values();    
  entrySet();    
  internalGetBinaryData();//不暴露    
  equals(result2);    
  put("1", (YasonValue) null);    
  put("1", (int)1);    
  put("1", (byte)1);    
  put("1", (Date) null);    
  put("1", (Long) null);    
  put("1", (Time) null);    
  put("1", (Float) null);    
  put("1", (Short) null);    
  put("1", (byte[]) null);    
  put("1", (Double) null);    
  put("1", (String) null);    
  put("1", (Boolean) null);    
  put("1", (LocalDate) null);    
  put("1", (LocalTime) null);    
  put("1", (Timestamp) null);    
  put("1", (BigDecimal) null);    
  put("1", (YasonValue) null);    
  put("1", (LocalDateTime) null);    
  put("1", (YasonValue) null);    
  putNull("1");    
  putAll( null);|OracleJsonObject|  
|  
|  
|
|YasonArray|add((int)1);    
  add((byte)1);    
  add((Date) null);    
  add((Long) null);    
  add((Time) null);    
  add((Float) null);    
  add((Short) null);    
  add((byte[]) null);    
  add((Double) null);    
  add((String) null);    
  add((Boolean) null);    
  add((LocalDate) null);    
  add((LocalTime) null);    
  add((Timestamp) null);    
  add((BigDecimal) null);    
  add((YasonValue) null);    
  add((LocalDateTime) null);    
  add(1, (int)1);    
  add(1, (byte)1);    
  add(1, (Date) null);    
  add(1, (Long) null);    
  add(1, (Time) null);    
  add(1, (Float) null);    
  add(1, (Short) null);    
  add(1, (byte[]) null);    
  add(1, (Double) null);    
  add(1, (String) null);    
  add(1, (Boolean) null);    
  add(1, (LocalDate) null);    
  add(1, (LocalTime) null);    
  add(1, (Timestamp) null);    
  add(1, (BigDecimal) null);    
  add(1, (YasonValue) null);    
  add(1, (LocalDateTime) null);    
  addNull();    
  addNull(1);    
  byteValue();    
  clear();    
  contains(null);    
  containsAll(null);    
  doubleValue();    
  equals(null);    
  floatValue();    
  get(1);    
  getBigDecimal();    
  getByte();    
  getDouble();    
  getFloat();    
  getInt();    
  getLong();    
  getShort();    
  getString();    
  getBigDecimal(1);    
  getBoolean(1);    
  getByte(1);    
  getBytes(1);    
  getDate(1);    
  getDouble(1);    
  getFloat(1);    
  getInt(1);    
  getLocalDate(1);    
  getLocalDateTime(1);    
  getLocalTime(1);    
  getLong(1);    
  getShort(1);    
  getString(1);    
  getTime(1);    
  getTimeStamp(1);    
  indexOf(null);    
  intValue();    
  internalGetBinaryData();//是否不暴露    
  isEmpty();    
  isNull(1);    
  iterator();//是否不暴露    
  longValue();    
  lastIndexOf(null);    
  listIterator();//是否不暴露    
  listIterator(1);    
  remove(null);    
  remove(1);    
  removeAll(null);    
  retainAll(null);    
  set(1, (int)1);    
  set(1, (byte)1);    
  set(1, (Date) null);    
  set(1, (Long) null);    
  set(1, (Time) null);    
  set(1, (Float) null);    
  set(1, (Short) null);    
  set(1, (byte[]) null);    
  set(1, (Double) null);    
  set(1, (String) null);    
  set(1, (Boolean) null);    
  set(1, (LocalDate) null);    
  set(1, (LocalTime) null);    
  set(1, (Timestamp) null);    
  set(1, (BigDecimal) null);    
  set(1, (YasonValue) null);    
  set(1, (LocalDateTime) null);    
  setNull(1);    
  size();    
  subList(1,2);    
  shortValue();    
  toArray();|OracleJsonArray|  
|  
|  
|
|YasonString|getString();    
  getType();    
  getValue();    
  getBigDecimal();    
  getByte();    
  getStringValue();    
  getBinaryData();    
  getDepth();    
  getDouble();    
  getFloat();    
  getInt();    
  getLong();    
  getShort();    
  getClass();    
  equals(null);    
  internalGetBinaryData();//是否不暴露    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|OracleJsonString|  
|  
|  
|
|YasonDecimal|getBigDecimal();    
  getString();    
  getDepth();    
  getByte();    
  getShort();    
  getType();    
  getValue();    
  getBinaryData();    
  getDouble();    
  getFloat();    
  getInt();    
  getLong();    
  getClass();    
  equals(null);    
  internalGetBinaryData();//是否不暴露    
  BigDecimalValue();//改大小写    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|OracleJsonDecimal|  
|  
|  
|
|YasonBoolean|getString();    
  getBigDecimal();    
  getByte();    
  getBinaryData();    
  getDepth();    
  getType();    
  getValue();    
  getDouble();    
  getFloat();    
  getInt();    
  getLong();    
  getShort();    
  getClass();    
  internalGetBinaryData();//是否不暴露    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();    
  getClass();|\|  
|  
|  
|
|YasonNull|getString();    
  getBigDecimal();    
  getByte();    
  getType();    
  getBinaryData();    
  getValue();    
  getDepth();    
  getDouble();    
  getFloat();    
  getInt();    
  getLong();    
  getShort();    
  getClass();//没有equals()    
  internalGetBinaryData();//不暴露    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();    
  equals(null);|\|  
|  
|  
|
|YasonByte|getByte();    
  getString();    
  getBigDecimal();    
  getType();    
  getBigDecimal();    
  getType();    
  getBinaryData();    
  getValue();    
  getDepth();    
  getDouble();    
  getFloat();    
  getInt();    
  getLong();    
  getShort();    
  getClass();    
  equals(null);    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|\|  
|  
|  
|
|YasonShort|getString();    
  getByte();    
  getBigDecimal();    
  getShort();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getDouble();    
  getFloat();    
  getInt();    
  getLong();    
  getClass();    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();,yasonShort.equals(null);|\|  
|  
|16-->smallint|
|YasonInteger|getByte();    
  getString();    
  getDouble();    
  getType();    
  getBigDecimal();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getFloat();    
  getInt();    
  getLong();    
  getShort();    
  getShort();    
  internalGetBinaryData();    
  equals(null);    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();    
  getClass();|\|  
|  
|包里为YasonInt.class建议改名|
|YasonBigInteger(YasonLong)|getString();    
  getLong();    
  getDouble();    
  getBigDecimal();    
  getByte();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getFloat();    
  getInt();    
  getShort();    
  getClass();    
  internalGetBinaryData();    
  equals(null);    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|\|  
|  
|包里没有YasonBigInteger,64-->bigint|
|YasonNumber|getString();    
  getFloat();    
  getDouble();    
  getBigDecimal();    
  getByte();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getInt();    
  getLong();    
  getString();    
  getClass();    
  getShort();    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|OracleJsonNumber|  
|  
|  
|
|YasonFloat|getString();    
  getFloat();    
  getDouble();    
  getBigDecimal();    
  getByte();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getInt();    
  getLong();    
  getString();    
  getClass();    
  getShort();    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|OracleJsonFloat|  
|  
|  
|
|YasonDouble|getString();    
  getFloat();    
  getDouble();    
  getBigDecimal();    
  getByte();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getInt();    
  getLong();    
  getString();    
  getClass();    
  getShort();    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|OracleJsonDouble|  
|  
|  
|
|YasonBinary|getString();    
  getFloat();    
  getDouble();    
  getBigDecimal();    
  getByte();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getInt();    
  getLong();    
  getString();    
  getClass();    
  getShort();    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|OracleJsonBinary|  
|  
|  
|
|YasonTimestamp|getString();    
  getFloat();    
  getDouble();    
  getBigDecimal();    
  getByte();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getInt();    
  getLong();    
  getString();    
  getClass();    
  getShort();    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|OracleJsonTimestamp|  
|  
|  
|
|YasonDate|getString();    
  getFloat();    
  getDouble();    
  getBigDecimal();    
  getByte();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getInt();    
  getLong();    
  getString();    
  getClass();    
  getShort();    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|OracleJsonDate|  
|  
|  
|
|YasonTime|getString();    
  getFloat();    
  getDouble();    
  getBigDecimal();    
  getByte();    
  getType();    
  getValue();    
  getBinaryData();    
  getDepth();    
  getInt();    
  getLong();    
  getString();    
  getClass();    
  getShort();    
  internalGetBinaryData();    
  BigDecimalValue();    
  byteValue();    
  doubleValue();    
  floatValue();    
  intValue();    
  longValue();    
  shortValue();    
  toString();|\|  
|  
|  
|
|YasonIntervalDS|\|OracleJsonIntervalDS|  
|  
|未实现，不测试|
|YasonIntervalYM|\|OracleJsonIntervalYM|  
|  
|未实现，不测试|
|YasonGenerator|writeStartArray();    
  writeStartArray("1");    
  writeStartObject();    
  write((int)1);    
  write((byte)1);    
  write((Long) null);    
  write((Float) null);    
  write((Short) null);    
  write((byte[]) null);    
  write((Double) null);    
  write((String) null);    
  write((Boolean) null);    
  write((BigInteger) null);    
  write((BigDecimal) null);    
  write((LocalDateTime) null);    
  write((YasonValue) null);    
  类型不全    
  write("1",(int)1);    
  write("1",(byte)1);    
  write("1",(Long) null);    
  write("1",(Float) null);    
  write("1",(Short) null);    
  write("1",(byte[]) null);    
  write("1",(Double) null);    
  write("1",(String) null);    
  write("1",(Boolean) null);    
  write("1",(BigDecimal) null);    
  write("1",(BigInteger) null);    
  write("1",(YasonValue) null);    
  write("1",(LocalDateTime) null);    
  writeOraNumber(null);//改名 bug    
  writeBinary(null);    
  writeDecimalFromParser(null);    
  writeDouble(null);    
  writeFloat(null);    
  writeDate((YasonDate) null);    
  writeDate((YasonTime) null); //改名 bug    
  writeKey("1");    
  writeNull();    
  writeNull("1");    
  writeString(null);    
  writeStringFromParser(null);    
  writeStringValue("1");    
  writeTimestamp(null);    
  writeYasonValue(null);    
  writeYasonParser(null);    
  writeParser(null);    
  writeEnd();    
  close();|OracleJsonGenerator|  
|  
|  
|
|YasonParser|next();    
  hasNext();    
  skipArray();    
  skipObject();    
  close();    
  isIntegralNumber();    
  getBigDecimal();    
  getDouble();    
  getBytes();    
  getBytes(outputStream);    
  getFloat();    
  getArray();    
  getBigInteger();    
  getDuration();    
  getInt();    
  getLastCharLocation();    
  getLocalDateTime();    
  getLocation();    
  getLong();    
  getObject();    
  getOffsetDateTime();    
  getPeriod();    
  getString();    
  getValue();|OracleJsonParser|  
|  
|  
|
|YasonFactory|createArray();    
  createArray((YasonArray) null);    
  createBinary((byte[]) null);    
  createBoolean();    
  createByte();    
  createDate();    
  createDecimal();    
  createDouble();    
  createFloat();    
  createInt();    
  createLong();    
  createNull();    
  createObject();    
  createObject((YasonObject)null);    
  createShort();    
  createString();    
  createTime((Time)null);    
  createTime((LocalTime) null);    
  createTimeStamp((Timestamp)null);    
  createTimestamp((LocalDateTime) null);,yasonFactory.createJsonTextGenerator((Writer)null);    
  yasonFactory.createJsonTextGenerator((OutputStream) null);    
  yasonFactory.createJsonTextParser((Reader) null);    
  yasonFactory.createJsonTextParser((InputStream) null);    
  yasonFactory.createJsonTextValue((Reader)null);    
  yasonFactory.createJsonTextValue((InputStream)null);|OracleJsonFactory|  
|  
|  
|


# 3.   **测试设计方法**

1.测试服务端的json类型的创建

2.插入

3.查询

4.元数据

5.验证接口命名是否合理

  


# 4.   **详细测试设计**

1.测试服务端的json类型的创建

涉及接口YasonFactory，YasonGenerator，YasonParser，测试覆盖所有接口

1）标量值的测试

createxxx，writexxx，getxxx接口覆盖正常值和异常值，

对于数值类型覆盖边界，对于字符串覆盖最大长度

  


2）向量值的测试

a.测试向量object、array最大嵌套深度、最大元素个数

b.测试object和array相互嵌套

c.向量中的元素覆盖所有标量类型

d.标量的增加、更新、删除

  


2.插入、更新

1）正常场景

覆盖setobject(1, Yasonxxx)所有yason类型

2）setobject(1, Yasonxxx)接口和数据库各种类型（char、varchar等）的转换

3）绑定参数测试插入和更新

4）select for update 客户端更新回写数据库（类似lob，是否支持）

  


3.查询

1）正常场景

覆盖getobject(1, Yasonxxx)所有yason类型

2）getobject(1, Yasonxxx)接口和数据库各种类型（char、varchar等）的转换

3）YasonXXX.getxxx类型转换

覆盖正常值和异常值，对于数值类型覆盖边界，对于字符串覆盖最大长度

4）验证getType()类型的正确性

5）使用sql、setstring等方式尽量插入更丰富类型的json数据以供查询

  


4.元数据

元数据相关方法

|  
|方法|备注|
|---|---|---|
|1|getTypeInfo（）|  
|
|2|getFunctionColumns（）|  
|
|3|getColumns（）|  
|
|4|getProcedureColumns（）|  
|
|5|getVersionColumns（）|  
|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 单机 yasdb_jdbc
1. 分布式dp_yasdb_jdbc
1. 集群暂无工程，添加


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

## Comments:

|  [](null)  ,setstring，使用服务端函数插入扩展类型,connection.prepareStatement("insert into " + table + " values(1,json(? EXTENDED))");,Posted by zhengsiyuan at 八月 09, 2023 14:40|
|---|
|  [](null)  ,number特殊值,inf nan,  
,Posted by zhengsiyuan at 八月 09, 2023 14:43|
|  [](null)  ,使用json三方件还是按标准json去处理,fastjson, jackson, javax.json, ,Posted by zhengsiyuan at 八月 09, 2023 14:45|
|  [](null)  ,性能：    
  编码、解码,json_serialize,Posted by zhengsiyuan at 八月 09, 2023 14:50|
|  [](null)  ,Json最大32M,测试并发,Posted by zhengsiyuan at 八月 09, 2023 14:52|
|  [](null)  ,数值类型超过边界,Posted by zhengsiyuan at 八月 09, 2023 14:54|
|  [](null)  ,resultset json的可滚动结果集、可更新结果集不支持,合理报错,Posted by zhengsiyuan at 八月 09, 2023 15:01|
|  [](null)  ,callable    
  测试过程体出入参,Posted by zhengsiyuan at 八月 09, 2023 15:03|
|  [](null)  ,@Test    
  public void testJson() throws SQLException {    
  Connection conn = AnchorConn.getConnDS();    
  Statement stmt = conn.createStatement();    
  PreparedStatement pstmt = conn.prepareStatement("insert into tb_YDBRD_15247_1 (id, c_json) values(?,?)");    
  pstmt.setInt(1,2);    
  pstmt.setString(2, "'{\"test\":1.1}'");    
  pstmt.execute();    
  conn.commit();,// ResultSet rs = stmt.executeQuery("select c_json from tb_YDBRD_15247_1 where id = 2");    
  // rs.next();    
  // Assert.assertEquals(rs.getNString(1), "'{\"test\":1.1}'");    
  //    
  // rs.close();    
  stmt.close();    
  pstmt.close();    
  conn.close();    
  },Posted by zhengsiyuan at 八月 10, 2023 17:03|
|  [](null)  ,查询字符串套json函数,Posted by zhengsiyuan at 八月 10, 2023 18:01|
