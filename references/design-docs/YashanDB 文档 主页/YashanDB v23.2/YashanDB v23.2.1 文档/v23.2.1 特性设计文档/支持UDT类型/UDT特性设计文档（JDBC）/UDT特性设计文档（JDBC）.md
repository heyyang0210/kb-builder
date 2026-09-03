Created by 方少奎, last modified on 二月 20, 2024

*详细设计 : *    [支持UDT类型](https://conf.yasdb.com/pages/viewpage.action?pageId=104226662)  

*IR链接：*    [YDBRD-20717](https://jira.yasdb.com/browse/YDBRD-20717?src=confmacro)    *-*  *JDBC支持ResultSet接口的特定方法*  *完成*

*SR链接：*    [YDBRD-22257](https://jira.yasdb.com/browse/YDBRD-22257?src=confmacro)    *-*  *【jdbc】支持java.sql.SQLInput接口的特定方法*  *完成*    [YDBRD-22250](https://jira.yasdb.com/browse/YDBRD-22250?src=confmacro)    *-*  *【jdbc】支持ResultSet特性方法*  *完成*

## 1.     [总述](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#1-%E6%80%BB%E8%BF%B0)  

  


###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

当前YashanDB JDBC未支持UDT（用户自定义）类型的查询和绑定，为满足用户自定义结构化类型需求，需要实现UDT相关功能特性。

通过调研，JDBC需要支持UDT类型数据的查询和参数绑定。

对于UDT Object类型，解析服务端的序列化数据，封装Struct对象返回给用户；

对于UDT Array类型，将序列化数据封装成Array对象返回。

支持UDT类型嵌套和JAVA CLASS与UDT类型的映射。

  


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

Oracle调研：    [Oracle UDT 调研](https://conf.yasdb.com/pages/viewpage.action?pageId=109576472)  

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能    
    
    
|支持查询UDT类型元数据|支持ResultSetMetaData相关接口,支持DatabaseMetaData相关接口，增加UDT类型的元数据返回|是|是|
||支持UDT类型查询|支持查询UDT完整数据|是|是|
||支持Struct对象和SQLData对象的映射|支持将UDT类型数据解析成SQLData对象|是|是|
||支持UDT类型插入和更新的参数绑定|构造参数绑定的对象，进行序列化处理，并以Stream传输绑定数据|是|是|


  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

  


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

  


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#2-%E6%8E%A5%E5%8F%A3)  

  


- java.sql.DatabaseMetaData


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|getAttributes(String catalog, String schemaPattern,       String typeNamePattern, String attributeNamePattern)|ResultSet|返回UDT类型指定属性的描述|是|
|getProcedureColumns(String catalog,      String schemaPattern,      String procedureNamePattern,      String columnNamePattern)|ResultSet|返回  指定的  存储过程参数和结果列（包含UDT）|是（TYPE_NAME为UDT全称）|
|getColumns(String catalog, String schemaPattern,      String tableNamePattern, String columnNamePattern)|ResultSet|返回  指定的  表列描述（包含UDT）|是（TYPE_NAME为UDT全称）|
|getUDTs(String catalog, String schemaPattern,      String typeNamePattern, int[] types)|ResultSet|返回指定的udt类型描述|是|
|getFunctionColumns(String catalog,      String schemaPattern,      String functionNamePattern,      String columnNamePattern)|ResultSet|返回指定函数参数和返回类型的描述（包含UDT）|是（TYPE_NAME为UDT全称）|


  


- java.sql.ResultSetMetaData


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|getColumnType(int column)|int|返回列类型SQLType|是|
|getColumnTypeName(int column)|String|返回列名|是|


  


- java.sql.Connection接口方法


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|createStruct(String typeName, Object[] attributes)|返回值：Array|通过Descriptor获取udt元数据并创建Struct对象|是|
|createArray(String typeName, Object[] elements)|返回值：Array|通过Descriptor获取udt元数据并创建Array对象|是|
|createArrayOf(String typeName, Object[] elements)|返回值：Array|不支持，入参  typeName为子元素数据类型，无法确定Array本身的tyPename|否|
|setTypeMap(Map<String,Class<?>> map)|参数：     map（udt类型对应的SQLData类）|设置map映射|是|
|getTypeMap()|返回值：  map（udt类型对应的SQLData类）|返回map映射|是|


  


- java.sql.PreparedStatement接口方法


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|setArray(int parameterIndex,Array x)|void|绑定Array类型数据|是|
|setNull(int parameterIndex,int sqlType,String typeName)|void|绑定空值|是|
|setObject(int index, Object x)|void|绑定Struct类型|是|


  


- java.sql.CallableStatement接口方法（暂不支持）


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|getArray (int parameterIndex)|返回值：Array|  
|否|
|registerOutParameter (int parameterIndex, SQLType sqlType, String typeName)|返回值：void|  
|否|
|registerOutParameter (int parameterIndex, int sqlType, String typeName)|返回值：void|  
|否|
|registerOutParameter(int parameterIndex, SQLType sqlType)|返回值：void|  
|否|


  


- java.sql.ResultSet接口方法：


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|ResultSet.getObject(int columnIndex)|参数：index（第index个元素，从1开始）,返回值：Object|返回Object数据，可强转成Struct类型|是|
|ResultSet.getObject(int columnIndex, Map<String,Class<?>> map)|参数：index（第index个元素，从1开始）map（udt类型对应SQLData类）,返回值：Object|返回Object数据，可强转成Struct类型|是|
|ResultSet.getArray(int columnIndex)|参数：columnIndex（第index个元素，从1开始）,返回值：Array|返回array数据|是|
|ResultSet.getArray(String columnLabel)|参数：columnLabel（结果集中列名为columnLabel的元素）,返回值：Array|返回array数据|是|


  


- java.sql.Struct接口方法：


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|Struct.getSQLTypeName()|返回值：String|返回udt类型名称，如：REGRESS.PERSON_TYP。|是|
|Struct.getAttributes()|返回值：Object[]|返回udt类型数据|是|
|Struct.getAttributes(Map<String,Class<?>> map)|参数：     map（udt类型对应的SQLData类）,返回值：Object[]|根据map对应class映射数据。|是|


  


- java.sql.Array接口方法：


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|Array.getBaseTypeName()|返回值：String|返回Array数据类型名称，如：建类型时是as array(5) of varchar(255)，即类型名称为varchar。|是|
|Array.getBaseType()|返回值：int|返回Array数据类型码|是|
|Array.getArray()|返回值：Object[]|返回Array数据。|是|
|Array.getArray(Map<String,Class<?>> map)|参数：     map（udt类型对应的SQLData类）,返回值：Object[]|根据map类型映射重新解析原始数据，再返回Array数据。,map是对Array子类型进行映射。|是|
|Array.getArray(long index, int count)|参数：     long（数据开始位置）     int（数据个数）,返回值：Object[]|返回index开始，count个数据。|是|
|Array.getArray(long index, int count, java.util.Map<String,Class<?>> map)|参数：     index（数据开始位置）     count（数据个数）     map（udt类型对应的SQLData类）,返回值：Object[]|重新映射，并返回index开始，count个数据。|是|
|Array.getResultSet()|返回值：RsultSet|返回Array数据的结果集。,仅支持向后读取数据，其他功能不支持。,每行数据包含2列，第一列为index，int类型，第二列为数据|是|
|Array.getResultSet (java.util.Map<String,Class<?>> map)|参数：     map（udt类型对应的SQLData类）,返回值：RsultSet|返回map映射的结果集。|是|
|Array.getResultSet(long index, int count)|参数：     index（数据开始位置）     count（数据个数）,返回值：RsultSet|返回从index开始，count个数据的结果集。|是|
|Array.getResultSet (long index, int count, java.util.Map<String,Class<?>> map)|参数：     index（数据开始位置）     count（数据个数）     map（udt类型对应的SQLData类）,返回值：RsultSet|返回map映射，从index开始，count个数据的结果集。|是|
|Array.free()|  
|释放资源，一旦调用free方法，Array及其ResultSet对象均无效。|是|


  


- java.sql.SQLInput接口方法：


|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|String readString()|返回值：String|读取UDT结构中子元素  String  数据|是|
|String readNString()|返回值：String|读取UDT结构中子元素  String  数据|是|
|boolean readBoolean()|返回值：boolean|读取UDT结构中子元素  boolean  数据|是|
|byte readByte()|返回值：byte|读取UDT结构中子元素  byte  数据|是|
|short readShort()|返回值：short|读取UDT结构中子元素  short  数据|是|
|int readInt()|返回值：int|读取UDT结构中子元素  int  数据|是|
|long readLong()|返回值：long|读取UDT结构中子元素  long  数据|是|
|float readFloat()|返回值：float|读取UDT结构中子元素  float  数据|是|
|double readDouble()|返回值：double|读取UDT结构中子元素  double  数据|是|
|BigDecimal readBigDecimal()|返回值：BigDecimal|读取UDT结构中子元素  BigDecimal  数据|是|
|byte[] readBytes()|返回值：byte[]|读取UDT结构中子元素  byte[]  数据|是|
|Date readDate()|返回值：Date|读取UDT结构中子元素  Date  数据|是|
|Time readTime()|返回值：Time|读取UDT结构中子元素  Time  数据|是|
|Timestamp readTimestamp()|返回值：TImestamp|读取UDT结构中子元素  TImestamp  数据|是|
|Object readObject()|返回值：Object|读取UDT结构中子元素Object数据|是|
|<T> T readObject(Class<T> type)|返回值：Class|读取UDT结构中子元素Json Object数据|是|
|Array readArray()|返回值：Array|读取UDT结构中子元素  Array  数据|是|
|RowId readRowId()|返回值：RowID|读取UDT结构中子元素  RowID  数据|是|
|boolean wasNull()|返回值：boolean|读取UDT结构中子元素Blob数据|是|
|Ref readRef()|返回值：Ref|不支持|否|
|Blob readBlob()|返回值：Blob|读取UDT结构中子元素Blob数据|是|
|Clob readClob()|返回值：Clob|读取UDT结构中子元素Clob数据|是|
|URL readURL()|返回值：URL|不支持|否|
|NClob readNClob()|返回值：NClob|读取UDT结构中子元素NClob数据|是|
|SQLXML readSQLXML()|返回值：SQLXML|读取UDT结构中子元素XMLTYPE数据|是|
|Reader readCharacterStream()|返回值：Reader|读取UDT结构中子元素数据的Reader对象|是|
|InputStream readAsciiStream()|返回值：InputStream|读取UDT结构中子元素数据InputStream对象|是|
|InputStream readBinaryStream()|返回值：InputStream|读取UDT结构中子元素数据InputStream对象|是|


  


- java.sql.SQLOutput接口：


用于参数绑定时，将SQLData对象转化成Struct。

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|writeString(String x)|参数：String|写入UDT子元素String到Struct|是|
|writeBoolean(boolean x)|参数：boolean|写入UDT子元素  boolean  到Struct|是|
|writeByte(byte x)|参数：byte|写入UDT子元素  byte  到Struct|是|
|writeShort(short x)|参数：short|写入UDT子元素  short  到Struct|是|
|writeInt(int x)|参数：int|写入UDT子元素  int  到Struct|是|
|writeLong(long x)|参数：long|写入UDT子元素  long  到Struct|是|
|writeFloat(float x)|参数：float|写入UDT子元素  float  到Struct|是|
|writeDouble(double x)|参数：double|写入UDT子元素  double  到Struct|是|
|writeBigDecimal(BigDecimal x)|参数：BigDecimal|写入UDT子元素  BigDecimal  到Struct|是|
|writeBytes(byte[] x)|参数：byte[]|写入UDT子元素  byte[]  到Struct|是|
|writeDate(Date x)|参数：Date|写入UDT子元素  Date  到Struct|是|
|writeTime(Time x)|参数：Time|写入UDT子元素  Time  到Struct|是|
|writeTimestamp(Timestamp x)|参数：Timestamp|写入UDT子元素  Timestamp  到Struct|是|
|writeCharacterStream(Reader x)|参数：Reader|写入UDT子元素  Reader  到Struct|是|
|writeAsciiStream(InputStream x)|参数：inputStream|写入UDT子元素  inputStream  到Struct|是|
|writeBinaryStream(InputStream x)|参数：inputStream|写入UDT子元素  inputStream  到Struct|是|
|writeObject(SQLData x)|参数：SQLData|写入UDT子元素  SQLData  到Struct|是|
|writeBlob(Blob x)|参数：Blob|写入UDT子元素  Blob  到Struct|是|
|writeClob(Clob x)|参数：Clob|写入UDT子元素  Clob  到Struct|是|
|writeStruct(Struct x)|参数：Struct|写入UDT子元素  Struct  到Struct|是|
|writeArray(Array x)|参数：Array|写入UDT子元素  Array  到Struct|是|
|writeRowId(RowId x)|参数：RowId|写入UDT子元素  RowId  到Struct|是|


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- UDT Object数据类型的查询，参数绑定；
- 支持UDT Object类型，Struct对象和SQLData对象的映射；
- UDT Array和UDT Table数据类型的查询，参数绑定；
- 支持查询UDT数据类型元数据；
- 存储过程不支持UDT。


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#4-%E7%89%B9%E6%80%A7)  

  


###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

udt特性功能。完成udt。

###   [4.2 特性功能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

DataBaseMetaData获取数据库元数据时，支持返回UDT类型数据。

查询表all_types中对应TYPE_NAME的数据。

select null as TYPE_CAT,owner as TYPE_SCHEM , TYPE_NAME, null as class_name,2002 as   DATA_TYPE, null as REMARKS,null as BASE_TYPE from all_types where TYPECODE='OBJECT'

###   [4.3 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

UDT类型结构元素支持所有数据类型。

UDT数据传输协议见：    [u - 史鑫 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?spaceKey=~shixin&title=u)  

JDBC执行select语句查询UDT类型数据时，JDBC获取服务端返回的序列化数据进行数据解析，解析格式如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c858970c2af4f520c8b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQkFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBQUFBQUlBQUFBQUFBSkFBQUJBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFDQ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEyODIsImV4cCI6MTc4MjMxMjA4Mn0.8W_uctjCWo2NdnYL7-2g5uGqKhMaHf8tbIohxAA41Q8)

服务端返回了AsLob格式的序列化数据，JDBC客户端需要对Lob数据按Blob类型处理，并进行lob read读取全部UTD数据。

再对全部UDT数据进行解析，解析时需要根据ToID和version检查元数据是否正确，再根据对应的数据类型解析member data。

  


###   [4.4 特性性能点3](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B93)  

对于UDT Object类型数据，支持将数据映射成SQLData对象。

实现以下方式设置map类型映射：

- connection.setTypeMap(map)
- resultSet.getObject(index, map)
- array.getArray(index, map)
- array.getResultSet(map)


map映射生效场景：

- connection.setTypeMap(map)仅在resultSet.getObject时判定是否生效；
- 当getObject, 不传参map，则connection.setTypeMap(map)生效；
- map映射遵循就近原则，getObject、getArray存在map时，仅使用当前map；getResultSet存在map，则在用户获取数据时不存在map时生效。


  


Map数据类型为Map<String, Class  <SQLData>  >；

其中String表示typeName全称，如：REGRESS.UDT_TYPE；Class  <SQLData>  表示SQLData类，如：TypeHolder.Class（TypeHolder类如下）。

public     class     TypeHolder     implements     SQLData   {    
           private     int     id  ;    
           private     String     value  ;    
           private     String     typeName  ;    
           @Override    
           public     String     getSQLTypeName  ()   throws     SQLException   {    
               return     typeName  ;    
        }    
           @Override    
           public     void     readSQL  (  SQLInput     stream  ,   String     typeName  )   throws     SQLException   {    
               this  .  typeName     =     typeName  ;    
               this  .  id     =     stream  .  readInt  ();    
               this  .  value     =     stream  .  readString  ();    
        }    
           @Override    
           public     void     writeSQL  (  SQLOutput     stream  )   throws     SQLException   {    
               stream  .  writeInt  (  this  .  id  );    
               stream  .  writeString  (  this  .  value  );    
        }    
     }

###   [4.5 特性性能点4](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#45-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B94)  

支持UDT类型插入更新的参数绑定。    
  1、先创建Struct（或Array）对象，指定UDT类型名称，向服务端查询该类型的元数据，此时，Struct对象保存元数据和UDT数据数组；    
  2、设置绑定参数，对Struct类型的数据进行序列化处理，绑定byte[]数据，并指定Stream逻辑处理；    
  3、执行插入（或更新），按照Stream逻辑处理。    
    
  系列化时，每个子元素数据根据元数据中的类型进行序列化，存在异常数据时应该抛出错误。

当UDT类型结构中存在lob类型时，序列化和反序列化的lob数据格式存在差异；

序列化时，hasLob场景中lob的协议格式如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c85a1ad9a3311dc8afc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQkFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBQUFBQUlBQUFBQUFBSkFBQUJBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFDQ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEyODIsImV4cCI6MTc4MjMxMjA4Mn0.8W_uctjCWo2NdnYL7-2g5uGqKhMaHf8tbIohxAA41Q8)

反序列化解析时，hasLob场景中lob的协议格式如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396c858970c2af4f520c8c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQkFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUNBQUFBQUlBQUFBQUFBSkFBQUJBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFDQ0FBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUNBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDEyODIsImV4cCI6MTc4MjMxMjA4Mn0.8W_uctjCWo2NdnYL7-2g5uGqKhMaHf8tbIohxAA41Q8)

  


###   [4.6 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#46-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#47-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.8 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#48-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

  


##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=141568496#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

  


## Attachments:

[image2024-1-15_9-1-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODU4OTcwYzJhZjRmNTIwYzg3IiwicmVmX2lkIjoiNjczOTZjODU3MjgyMDZlZmI5MmYxMzhiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMjgyLCJleHAiOjE3ODIzODc2ODJ9.Wdo6jPeV1IM6cl29_7jYKS3iibKSz63UFwX2bNtFPJY)

 (image/png)    


[image2024-1-18_18-22-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODU4OTcwYzJhZjRmNTIwYzg4IiwicmVmX2lkIjoiNjczOTZjODU3MjgyMDZlZmI5MmYxMzhiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMjgyLCJleHAiOjE3ODIzODc2ODJ9.eG_2jl5PfmbDAYXd24sN0WNEbnD-sM09wAxoKYVPd6I)

 (image/png)    


[image2024-2-19_9-30-5.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODVhMWFkOWEzMzExZGM4YWZhIiwicmVmX2lkIjoiNjczOTZjODU3MjgyMDZlZmI5MmYxMzhiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMjgyLCJleHAiOjE3ODIzODc2ODJ9.WL2ZCOWzaJjJ25vzCTDsnixUUCLYVUegaTfWqo2r76E)

 (image/png)    
