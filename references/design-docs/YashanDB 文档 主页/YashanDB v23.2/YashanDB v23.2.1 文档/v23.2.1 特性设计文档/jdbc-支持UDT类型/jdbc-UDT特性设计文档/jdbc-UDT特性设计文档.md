Created by 张周玺 on 十月 18, 2024

  


*详细设计 : *    [支持UDT类型](https://conf.yasdb.com/pages/viewpage.action?pageId=104226662)  

* IR链接：*

  [https://jira.yasdb.com/browse/YDBRD-20717](https://jira.yasdb.com/browse/YDBRD-20717)  

*SR链接：*

  [[YDBRD-22257] 【jdbc】支持java.sql.SQLInput接口的特定方法 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22257)  

  [[YDBRD-22250] 【jdbc】支持ResultSet特性方法 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-22250)  

  


##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#1-%E6%80%BB%E8%BF%B0)  

  


###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

通过对Oracle的调研，JDBC需要支持UDT类型数据的查询。

对于UDT Object类型，解析服务端的序列化数据，封装Struct对象返回给用户；

对于UDT Array类型，将序列化数据封装成Array对象返回。

支持UDT类型嵌套和JAVA CLASS与UDT类型的映射。

  


###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

Oracle调研：    [Oracle UDT 调研](https://conf.yasdb.com/pages/viewpage.action?pageId=109576472)  

  


###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

1）JDBC支持UDT类型数据查询与结果集获取；

2）Java类与数据库UDT类型映射处理

  


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

  


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

  


##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#2-%E6%8E%A5%E5%8F%A3)  

ResultSet接口方法：

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|ResultSet.getObject(int columnIndex)|参数：index（第index个元素，从1开始）   ,返回值：Object|返回Object数据，可强转成Struct类型|是|
|ResultSet.getObject(int columnIndex, Map<String,Class<?>> map)|参数：index（第index个元素，从1开始）map（udt类型对应SQLData类）   ,返回值：Object|返回Object数据，可强转成Struct类型|是|
|ResultSet.getArray(int columnIndex)|参数：columnIndex（第index个元素，从1开始）   ,返回值：Array|返回array数据|是|
|ResultSet.getArray(String columnLabel)|参数：columnLabel（结果集中列名为columnLabel的元素）,   返回值：Array|返回array数据|是|


Connection接口方法：

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|setTypeMap(Map<String,Class<?>> map)|参数：     map（udt类型对应的SQLData类）|设置map映射|是|
|getTypeMap()|返回值：  map（udt类型对应的SQLData类）|返回map映射|是|


Struct接口方法：

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|Struct.getSQLTypeName()|返回值：String|返回udt类型名称，如：REGRESS.PERSON_TYP。|是|
|Struct.getAttributes()|返回值：Object[]|返回udt类型数据|是|
|Struct.getAttributes(Map<String,Class<?>> map)|参数：     map（udt类型对应的SQLData类）   ,返回值：Object[]|根据map对应class映射数据。|是|


Array接口方法：

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|Array.getBaseTypeName()|返回值：String|返回Array数据类型名称，如：建类型时是as array(5) of varchar(255)，即类型名称为varchar。|是|
|Array.getBaseType()|返回值：int|返回Array数据类型码|是|
|Array.getArray()|返回值：Object[]|返回Array数据。|是|
|Array.getArray(Map<String,Class<?>> map)|参数：     map（udt类型对应的SQLData类）   ,返回值：Object[]|根据map类型映射重新解析原始数据，再返回Array数据。,map是对Array子类型进行映射。|是|
|Array.getArray(long index, int count)|参数：     long（数据开始位置）     int（数据个数）   ,返回值：Object[]|返回index开始，count个数据。|是|
|Array.getArray(long index, int count, java.util.Map<String,Class<?>> map)|参数：     index（数据开始位置）     count（数据个数）     map（udt类型对应的SQLData类）   ,返回值：Object[]|重新映射，并返回index开始，count个数据。|是|
|Array.getResultSet()|返回值：RsultSet|返回Array数据的结果集。,仅支持向后读取数据，其他功能不支持。,每行数据包含2列，第一列为index，int类型，第二列为数据|是|
|Array.getResultSet (java.util.Map<String,Class<?>> map)|参数：     map（udt类型对应的SQLData类）   ,返回值：RsultSet|返回map映射的结果集。|是|
|Array.getResultSet(long index, int count)|参数：     index（数据开始位置）     count（数据个数）   ,返回值：RsultSet|返回从index开始，count个数据的结果集。|是|
|Array.getResultSet (long index, int count, java.util.Map<String,Class<?>> map)|参数：     index（数据开始位置）     count（数据个数）     map（udt类型对应的SQLData类）   ,返回值：RsultSet|返回map映射，从index开始，count个数据的结果集。|是|
|Array.free()|  
|释放资源，一旦调用free方法，Array及其ResultSet对象均无效。|是|


SQLInput接口方法：

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|String readString()|返回值：String|  
|是|
|String readNString()|返回值：String|  
|是|
|boolean readBoolean()|返回值：boolean|  
|是|
|byte readByte()|返回值：byte|  
|是|
|short readShort()|返回值：short|  
|是|
|int readInt()|返回值：int|  
|是|
|long readLong()|返回值：long|  
|是|
|float readFloat() throws SQLException;|返回值：float|  
|是|
|double readDouble() throws SQLException;|返回值：double|  
|是|
|BigDecimal readBigDecimal() throws SQLException;|返回值：BigDecimal|  
|是|
|byte[] readBytes() throws SQLException;|返回值：byte[]|  
|是|
|Date readDate() throws SQLException;|返回值：Date|  
|是|
|Time readTime() throws SQLException;|返回值：Time|  
|是|
|Timestamp readTimestamp() throws SQLException;|返回值：TImestamp|  
|是|
|Object readObject() throws SQLException;|返回值：Object|  
|是|
|<T> T readObject(Class<T> type) throws SQLException;|返回值：Class|  
|是|
|Array readArray() throws SQLException;|返回值：Array|  
|是|
|RowId readRowId() throws SQLException;|返回值：RowID|  
|是|
|boolean wasNull()|返回值：boolean|  
|是|
|Ref readRef()|返回值：Ref|  
|否|
|Blob readBlob()|返回值：Blob|  
|否|
|Clob readClob()|返回值：Clob|  
|否|
|URL readURL()|返回值：URL|  
|否|
|NClob readNClob()|返回值：NClob|  
|否|
|SQLXML readSQLXML()|返回值：SQLXML|  
|否|
|Reader readCharacterStream()|返回值：Reader|  
|否|
|InputStream readAsciiStream()|返回值：InputStream|  
|否|
|InputStream readBinaryStream()|返回值：InputStream|  
|否|


  


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

实现UDT查询功能，数据小于63K，不含lob数据类型。

  


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#4-%E7%89%B9%E6%80%A7)  

特性功能点1：JDBC支持UDT类型数据查询与结果集获取；

特性功能点2：Java类与数据库UDT类型映射处理

  


###   [4.1 特性设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

  


###   [4.2 特性功能点1](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B91)  

(Struct) ResultSet.getObject(index) 获取udt struct对象

ResultSet.getArray(index) 获取udt array对象

支持udt对象嵌套。

![](https://pingcode.yasdb.com/atlas/files/public/67396c168970c2af4f520918/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5ODQsImV4cCI6MTc4MjMwOTc4NH0.xZMxRowCo_BkRF-q6Kbr6kQz_BruKorRQLlEDjU7Jqo)

###   [4.3 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

支持Java SQLData子类与数据库UDT类型映射。

支持以下方式设置map类型映射：

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

public     class     TypeHolder     implements     SQLData   {    
           private     int     id  ;    
           private     String     value  ;    
           private     String     typeName  ;    
           @Override    
           public     String     getSQLTypeName  ()   throws     SQLException   {    
               return     typeName  ;    
        }    
           @Override    
           public     void     readSQL  (  SQLInput     stream  ,   String     typeName  )   throws     SQLException   {    
               this  .  typeName     =     typeName  ;    
               this  .  id     =     stream  .  readInt  ();    
               this  .  value     =     stream  .  readString  ();    
        }    
           @Override    
           public     void     writeSQL  (  SQLOutput     stream  )   throws     SQLException   {    
               stream  .  writeInt  (  this  .  id  );    
               stream  .  writeString  (  this  .  value  );    
        }    
     }

###   [4.4 特性性能点3](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B93)  

增加DBMS_PICKLER.GET_TYPE_SHAPE高级包函数支持（JDBC内部调用）。

高级包函数参数信息：

|参数|说明|类型|IN/OUT|
|:---|:---|:---|:---|
|返回值|tdsFlag，标识TDS数据是否通过lob发送，非0表示lob发送。|INT|OUT|
|FULLTYPENAME|自定义类型全名称，oracle将其作为in参数。|VARCHAR|IN/OUT|
|TYPOID|自定义类型 oid。|BIGINT|OUT|
|VERSION|类型版本号, alter type 后自增，初始版本为1。|INT|OUT|
|TDS|Type Descriptor Source，包含 attr numbers，n个属性type code；如果tdsFlag为1，标识该字段是lob发送。|RAW|OUT|
|INSTANTIABLE|是否可实例化，通常为YES。|VARCHAR|OUT|
|SUPERTYPE_OWNER|父类型所属schema。|VARCHAR|OUT|
|SUPERTYPE_NAME|父类型名称。|VARCHAR|OUT|
|ATTR_RC|属性元数据信息 cursor。|SYS_REFCURSOR|OUT|
|SUBTYPE_RC|子类型元数据信息cursor。|SYS_REFCURSOR|OUT|


ATTR_RC属性元数据信息：

|字段|说明|
|:---|:---|
|1|固定值，1，image format（Oracle的数据格式标志）|
|SYS.ATTRIBUTE$.NAME|属性名称|
|SYS.ATTRIBUTE$.ATTRIBUTE#|属性序号，表示类型的第几个属性；从1开始|
|DTypeName/ SYS."_CURRENT_EDITION_OBJ".NAME|类型名称，比如VARCHAR2，NUMBER，NVARCHAR2，CLOB|
|NULL/SYS.USER$.NAME|属性类型（是自定义类型）owner的名称，普通类型为null|
|SYS.ATTRIBUTE$.ATTR_TOID|属性的type id，如果属性类型也是自定义类型|
|DECODE(BITAND(T.PROPERTIES, 65536), 65536, 'NO', 'YES')|类型是否可实例化，通常都是YES|
|SYS.USER$.NAME|父类型的schema，如果属性类型有父类型|
|SYS."_CURRENT_EDITION_OBJ".NAME|父类型的type name，如果属性类型有父类型|


SUBTYPE_RC子类型元数据信息：

|字段|说明|
|:---|:---|
|1|固定值，1，image format（Oracle的数据格式标志）|
|SYS.USER$.NAME|子类型owner的名称|
|SYS."_CURRENT_EDITION_OBJ".NAME|子类型名称|
|SYS."_CURRENT_EDITION_OBJ".OID$|子类型的type oid|


jdbc内部调用示例：

String fullTypeName =   "REGRESS.TEST_UDT_TYP"  ;    
  String callSql =   "begin :1 := sys.dbms_pickler.get_type_shape(:2, :3, :4, :5, :6, :7, :8, :9, :10); end;"  ;    
  CallableStatement callableStatement = session  .getConnection  ()  .prepareCall  (callSql);    
  callableStatement  .setString  (  2  , fullTypeName);    
  callableStatement  .registerOutParameter  (  1  , YasTypes  .INTEGER  );    
  callableStatement  .registerOutParameter  (  2  , YasTypes  .VARCHAR  );    
  callableStatement  .registerOutParameter  (  3  , YasTypes  .BIGINT  );    
  callableStatement  .registerOutParameter  (  4  , YasTypes  .INTEGER  );    
  callableStatement  .registerOutParameter  (  5  , YasTypes  .RAW  );    
  callableStatement  .registerOutParameter  (  6  , YasTypes  .VARCHAR  );    
  callableStatement  .registerOutParameter  (  7  , YasTypes  .VARCHAR  );    
  callableStatement  .registerOutParameter  (  8  , YasTypes  .VARCHAR  );    
  callableStatement  .registerOutParameter  (  9  , YasTypes  .REF_CURSOR  );    
  callableStatement  .registerOutParameter  (  10  , YasTypes  .REF_CURSOR  );    
  callableStatement  .execute  ();

  


###   [4.5 特性可维可测设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

  


##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

|自测设计方案|描述|
|:---|:---|
|udt Object |自定义类型覆盖所有基础类型，获得结果集|
|udt object as object of udt object|自定义udt类型嵌套udt类型，获得结果集|
|udt object of udt array|自定义udt类型嵌套array类型，获得结果集|
|udt array of scalar type|自定义udt array类型覆盖所有基础类型，获得结果集|
|udt array of udt object|自定义udt array类型嵌套udt类型，获得结果集|
|udt nested table of scalar type|自定义udt nested table类型覆盖所有类型，获得结果集|
|udt nested table of udt object|自定义udt nested table类型嵌套udt类型，获得结果集|
|array getResultSet|udt array类型获得array结果集，仅支持向后读取数据，其他功能不支持。|
|array free|当array调用free后，array及其resultSet同步失效。|
|Mapping|map映射Class|


  


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138557155#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1、支持udt参数绑定；

2、支持udt lob类型。

## Attachments:

[image2024-1-25_15-6-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTVhMWFkOWEzMzExZGM4Nzg0IiwicmVmX2lkIjoiNjczOTZjMTU1OTNmOTljOWZmMjM2YTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTgzLCJleHAiOjE3ODIzODUzODN9.LTIusRCYZ41aNZdHoOOhnturbGim4dsExXN0MuQZ4QE)

 (image/png)    


[image2024-1-25_15-6-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTU4OTcwYzJhZjRmNTIwOTE3IiwicmVmX2lkIjoiNjczOTZjMTU1OTNmOTljOWZmMjM2YTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTgzLCJleHAiOjE3ODIzODUzODN9.zi3Qj8QStGcfuzqbebskxGBR3uRdbT1AV-IKBXVgvRU)

 (image/png)    


[image2024-1-25_15-6-10.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTZhMWFkOWEzMzExZGM4Nzg1IiwicmVmX2lkIjoiNjczOTZjMTU1OTNmOTljOWZmMjM2YTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTgzLCJleHAiOjE3ODIzODUzODN9.3EsVEcHC3lMof0wfxGgWmGSP3pXbgBi0qYNlOKiR5II)

 (image/png)    


[image2023-12-13_20-18-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMTZhMWFkOWEzMzExZGM4Nzg2IiwicmVmX2lkIjoiNjczOTZjMTU1OTNmOTljOWZmMjM2YTIwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk4OTgzLCJleHAiOjE3ODIzODUzODN9.pzKCHQBTM7Z4uAeRxH6UV-JWLLZBp9XFH9zS10CWJPY)

 (image/png)    
