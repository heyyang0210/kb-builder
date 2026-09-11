Created by 张周玺 on 十月 18, 2024

  


需求链接：    [YDBRD-13087](https://jira.yasdb.com/browse/YDBRD-13087?src=confmacro)    -  【驱动】JDBC支持UDT类型  完成

Oracle调研：    [jdbc-Oracle UDT 调研](171068480.html)  

##   
    [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#1-overview%E6%A6%82%E8%BF%B0)  

说明本设计方案的需求来源，需求分析，功能概要描述。参照已有商业数据库开发的特性，原则上必须有特性调研文档。

本设计文档详细说明了：

1）JDBC支持UDT类型数据查询与结果集获取；

2）UDT类型元数据获取方式；

3）UDT类型的数据传输协议格式；

4）Java类与数据库UDT类型映射处理

  


##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

必选：说明本方案的功能特性。有等价类的正交划分形式，给出功能特性设计出来的规格全貌。

|功能特性|场景|
|:---|---|
|JDBC支持查询UDT类型数据|select查询结果集获取UDT列|
|JDBC支持UDT类型插入与更新|prepare绑定参数支持UDT类型；,存储过程注册out参数支持UDT类型；|
|支持获取UDT类型元数据|DatabaseMeata接口获取UDT类型信息|
|JDBC支持自定义Java类映射UDT类型|Connection设置typeMap|


  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#3-interfaces%E6%8E%A5%E5%8F%A3)  

列出从IR层级对外可以感知的特性，对应提供的接口、配置参数、API等。

|  
|接口|方法|说明|
|---|---|---|---|
|1|java.sql.Struct|String   getSQLTypeName  ()   throws   SQLException  ;    
,Object[]   getAttributes  ()   throws   SQLException  ;,Object[]   getAttributes  (java.util.Map<String  ,  Class<?>> map)    
  throws   SQLException  ;|若应用未提供数据库自定义类型到Javal Class的映射 typeMap，则Object类型默认映射到Struct接口实例|
|2|java.sql.REF|  
|客户端暂不支持，服务端尚未支持。|
|3|java.sql.Array|String   getBaseTypeName  ()   throws   SQLException  ;    
,int   getBaseType  ()   throws   SQLException  ;,Object   getArray  ()   throws   SQLException  ;,Object   getArray  (java.util.Map<String  ,  Class<?>> map)   throws   SQLException  ;    
,Object   getArray  (  long   index  , int   count)   throws   SQLException  ;,Object   getArray  (  long   index  , int   count  ,   java.util.Map<String  ,  Class<?>> map)    
  throws   SQLException  ;,ResultSet   getResultSet   ()   throws   SQLException  ;,ResultSet   getResultSet   (java.util.Map<String  ,  Class<?>> map)   throws   SQLException  ;,ResultSet   getResultSet  (  long   index  , int   count)   throws   SQLException  ;    
,ResultSet   getResultSet   (  long   index  , int   count  ,    
                            java.util.Map<String  ,  Class<?>> map)    
  throws   SQLException,void   free  ()   throws   SQLException  ;|若应用未提供数据库自定义类型到Javal Class的映射 typeMap，则Array类型、Nested Table类型默认映射到Array接口实例|
|4|java.sql.SQLData|String   getSQLTypeName  ()   throws   SQLException  ;    
,void   readSQL   (SQLInput stream  ,   String typeName)   throws   SQLException  ;,void   writeSQL   (SQLOutput stream)   throws   SQLException  ;|JDBC允许应用自定义Class，对应服务端的某个自定义类型；,该接口定义了自定义Class的必要方法。,readSQL方法由应用开发者负责实现，用户将服务端查询出来的自定义类型实例化为自定义Class对象；,属性、类型读取的顺序由开发者自己保证，如果读取一个非对应字段，可能会抛出异常；,writeSQL用户更新特性字段，由应用开发者负责实现；在执行发送绑定入参时，更新到服务端数据库中；writeSQL的字段写入顺序由开发者保证，否则可能抛出异常。|
|5|java.sql.SQLInput|readXX接口，包括：    
    
  String   readString  ()   throws   SQLException  ;    
,boolean   readBoolean  ()   throws   SQLException  ;,<  T  >   T   readObject  (Class<  T  > type)   throws   SQLException    
  等支持的类型读|java.sql.SQLData 的接口配合类；,JDBC内部使用，内部实现。|
|6|java.sql.SQLOutput|writeXX接口，包括：,void   writeString  (String x)   throws   SQLException  ;    
,void   writeBoolean  (  boolean   x)   throws   SQLException  ;,void   writeObject  (Object x  ,   SQLType targetSqlType)   throws   SQLException    
  等支持的类型写|java.sql.SQLData 的接口配合类；,JDBC内部使用，内部实现。|
|7|PreparedStatement|void   setObject  (  int   parameterIndex  ,   Object x)   throws   SQLException  ;,void   setNull   (  int   parameterIndex  , int   sqlType  ,   String typeName)    
  throws   SQLException  ;    
|绑定参数支持UDT类型|
|8|ResultSet|Object   getObject  (  int   columnIndex)   throws   SQLException;,Object   getObject  (  int   columnIndex  ,   java.util.Map<String  ,  Class<?>> map)    
  throws   SQLException  ;    
    
|结果集支持获取UDT类型|
|9|CallableStatement|void   registerOutParameter   (  int   parameterIndex  , int   sqlType  ,   String typeName)    
  throws   SQLException  ;,void   registerOutParameter   (  int   parameterIndex  ,   SQLType sqlType  ,    
            String typeName)   throws   SQLException,Object   getObject  (  int   parameterIndex  ,   java.util.Map<String  ,  Class<?>> map)    
  throws   SQLException|注册UDT类型out参数；,获取UTD类型出参结果|
|10|Connection|Struct   createStruct  (String typeName  ,   Object[] attributes)    
  throws   SQLException  ;    
,void   setTypeMap  (java.util.Map<String  ,  Class<?>> map)   throws   SQLException  ;,java.util.Map<String  ,  Class<?>>   getTypeMap  ()   throws   SQLException  ;,  
  不支持方法：    
,Array   createArrayOf  (String typeName  ,   Object[] elements)   throws    
  SQLException  ;    
    
  08.05新增，对齐Oracle，提供扩展接口：,Array   createArray  (String typeName  ,   Object[] elements)   throws   SQLException  ;|设置类型映射；,创建Struct实例,创建Array实例，用法示例：,String[] names =     
  new   String[] {  "TomCat"  ,   "Spring"  ,   "Hibernate"  ,   "MyBatis"  ,   "Activity"  }  ;    
  Array clientArray =     
  ((YasConnection) connection).createArray(  "regress.name_list_type"  ,   names)  ;|
|11|DatabaseMetaData|ResultSet   getUDTs  (String catalog  ,   String schemaPattern  ,       
    String typeNamePattern  , int  [] types)   throws   SQLException  ;    
,ResultSet   getTypeInfo  ()   throws   SQLException  ;|获取UDT类型信息|
|12|高级包元数据获取函数|:1 := sys.dbms_pickler.get_type_shape(:2,:3,:4,:5,:6,:7,:8,:9,:10)|高级包函数调用，获取udt 类型完整元数据|


  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。

  


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

必选项1：关键技术点为PL/SQL server端实现，调试协议族设计，yacli接口实现；

  


### 整体设计

查询获取结果

![](https://pingcode.yasdb.com/atlas/files/public/67396c138970c2af4f520914/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTg5NzAsImV4cCI6MTc4MjMwOTc3MH0.My582znbTCJ7VatjveNkMcep1xY3BBBgjWE1a_0EWug)

  


### 协议变更

对于udt类型，列信息中增加full type name信息。

兼容性：

高版本客户端 → 低版本服务端，不涉及UDT

低版本客户端 → 高版本服务端 ，服务端拦截，报错不支持。

#### AckPrepare

|sid(16)||columnCount(16)||
|:---:|---|:---:|---|
|paramCount(16)||sqlType(8)|unused|
|columns(0 ..columnCount)||||
|params(0 .. paramCount)||||


#### ColumnDesc

|id(16)||size(16)||
|:---:|---|:---:|---|
|type(8)|precision(8)|scale(8)|flag(8)|
|nameLen(8)|nameStr(nameLen*8)|||
|typeNameLen(8)|typeNameStr  (typeNameLen*8)|||


**对于udt类型，列信息中增加full type name信息**

  


### UDT数据查询流程

1）客户端发起select请求；

2）服务端对于UDT column    
  ack prepare 中Co  lumnAttr typ  e 发送 DTYPE_UDT_OBJECT 或者 DTYPE_UDT_ARRAY、DTYPE_UDT_TABLE 表示UDT类型；    
  ColumnDesc中增加 full type name信息发送；

3）服务端发送UDT数据，UDT数据按照自定义格式拼装；

4）客户端识别UDT类型，接收UDT数据；

5）客户端通过 full type name 获取UDT类型元数据信息，通过高级包（参考Oracle）调用或者组SQL获取；

6）JDBC对于结果集获取UDT，根据元数据字段，使用数据填充，给出Struct或者Array、自定义Java Class 实例，返回给应用。

  


### UDT类型元数据获取

1)  UDT column 信息中返回类型标识(DTYPE_UDT_OBJECT 或者 DTYPE_UDT_ARRAY、DTYPE_UDT_TABLE) 与 full type name信息；

2）客户端接收数据，通过full type name 获取完整元数据信息。

  


获取方式：

#### 增加高级包函数支持

begin :1 := sys.dbms_pickler.get_type_shape(:2,:3,:4,:5,:6,:7,:8,:9,:10); end;

第2个参数为入参，bigint，输入full type name。

  


参考Oracle：

高级包函数：sys.dbms_pickler.get_type_shape

|  
|参数|说明|类型|IN/OUT|
|---|---|---|---|---|
|1|返回值|tdsFlag，标识TDS数据是否通过lob发送，非0表示lob发送。,TDS，Type Descriptor Source|int|OUT|
|2|FULLTYPENAME |自定义类型全名称，oracle将其作为in参数|varchar|IN/OUT|
|3|TYPOID |自定义类型 oid    
  yashan 该字段类型为 bigint|raw|OUT|
|4|VERSION |类型版本号, alter type 后自增，初始版本为1|int|OUT|
|5|TDS|Type Descriptor Source，包含 attr numbers，n个属性type code；如果tdsFlag为1，标识该字段是lob发送|raw|OUT|
|6|INSTANTIABLE |是否可实例化，通常为YES|varchar|OUT|
|7|SUPERTYPE_OWNER |父类型所属schema|varchar|OUT|
|8|SUPERTYPE_NAME |父类型名称|varchar|OUT|
|9|ATTR_RC |属性元数据信息 cursor|ref cursor|OUT|
|10|SUBT  YPE_RC   |子类型元数据信息cursor|ref cursor|OUT|


  


begin :1 := sys.dbms_pickler.get_type_shape(:2,:3,:4,:5,:6,:7,:8,:9,:10); end;

FUNCTION GET_TYPE_SHAPE RETURNS BINARY_INTEGER    
  Argument Name Type In/Out Default?    
  ------------------------------ ----------------------- ------ --------    
  FULLTYPENAME VARCHAR2 IN/OUT    
  TYPOID RAW OUT    
  VERSION BINARY_INTEGER OUT    
  TDS LONG RAW OUT    
  INSTANTIABLE VARCHAR2 OUT    
  SUPERTYPE_OWNER VARCHAR2 OUT    
  SUPERTYPE_NAME VARCHAR2 OUT    
  ATTR_RC REF CURSOR OUT    
  SUBTYPE_RC REF CURSOR OUT    


  


属性通过 cursor出参 ATTR_RC 返回；

子类型通过 cursor出参 SUBTYPE_RC返回；

  


#### TDS(Type Descriptor Source)

自定义类型描述信息。

格式：

|tdsDataSize(u64)|
|:---:|
|tdsVersion(u8)|
|attrsCount(u16)|
|typeMetaData[attrsCount]|
|typeFlag(u8)|


说明：如果属性类型为Udt类型，则追加一个patch，内容为tdsOffset,表示utd类型元数据的实际偏移位置。

typeMetaData：复用 ColumnAttr(u64)

typedef union UnColumnAttr {    
  CodUint64 value;    
  struct {    
  CodUint16 id;    
  CodUint16 size;    
  CodUint8 type;    
  CodUint8 precision;    
  CodInt8 scale;    
  CodUint8 nullable : 1;    
  CodUint8 invisible : 1;    
  CodUint8 isChar : 1;    
  CodUint8 unused : 5;    
  };    
  } ColumnAttr;

  


udt type metaData: {ColumnAttr, patchOffset(u64)}

object type patch: {attrsCount, typeMeataData[attrsCount]}

array type/ nested table type: {attrsCouont(0), maxSize(u32), element typeMeataData}

  


参考Oracle格式为：

|tdsDataSize(u64)|
|:---:|
|tdsV  ersion(u8)|
|attrsCount(u16)|
|typeMeataData[attrsCount]|
|patchFlag(u8)|
|patch[n]|
|typeFlag(u8)|


说明：

**tdsDataSize**

tds 信息数据总长度

**tdsVersion**

格式版本控制

Oracle中final类型为1，not final类型为3；对于not final类型，tds中包含typeFalg，用于标识 isJavaObject, is final type

**attrsCount**

类型属性个数

**typeMeataData**

typeCode + MataData

number: {precision, scale}

char, varchar: {charSize}

interval: {precision, scale}

float: {precision}

raw: {rawSize}

timeStamp: {precision}

object type: {recursive tdsInfo(不包括tdsDataSize, tdsVersion, attrsCount)}

array type: {maxSize,   **patchInfo**  }

nested table type: {0,   **patchInfo**  }

**patchInfo**

表示array 或 nested table 类型tds信息；

内容为一个偏移位置，表示从offset开始表示此patch的对应实际内容。

**patch**

元素类型为普通类型：{  **typeMeataData**  }

元素类型为Object Type：{recursive tds, 不再包含tdsDataSize，tdsVersion，attrsCount}

元素类型为Array 或 nested table：{reursive {maxSize,   **patchInfo}**  }

**typeFlag**

finalType, javaObject

  


#### 属性元数据信息

yashan中没有typeNameSec，其他同Oracle。

查询SQL，  参考Oracle: 

|  
|字段|说明|
|---|---|---|
|1|1|固定值，1，image format（Oracle的数据格式标志）|
|2|SYS.ATTRIBUTE$.NAME|属性名称|
|3|SYS.ATTRIBUTE$.ATTRIBUTE#|属性序号，表示类型的第几个属性；从1开始|
|4|DTypeName/ SYS."_CURRENT_EDITION_OBJ".NAME|类型名称，比如VARCHAR2，NUMBER，NVARCHAR2，CLOB|
|5|NULL/SYS.USER$.NAME|属性类型（是自定义类型）owner的名称，普通类型为null|
|6|typeNameSec|属性typeName组成字段，如果不为null，则full type name为：{para5}.{para6}.{para4},19c, ojdbc8 中都是固定值null|
|7|SYS.ATTRIBUTE$.ATTR_TOID|属性的type id，如果属性类型也是自定义类型|
|8|DECODE(BITAND(T.PROPERTIES, 65536), 65536, 'NO', 'YES') |类型是否可实例化，通常都是YES|
|9|SYS.USER$.NAME|父类型的schema，如果属性类型有父类型|
|10|SYS."_CURRENT_EDITION_OBJ".NAME|父类型的type name，如果属性类型有父类型|


  


OPEN ATTR_RC FOR     
  SELECT /*+ NOPARALLEL */ 1, A.NAME, A.ATTRIBUTE#,    
  DECODE(AT.TYPECODE,    
  9, DECODE(A.CHARSETFORM, 2, 'NVARCHAR2', ATO.NAME),    
  96, DECODE(A.CHARSETFORM, 2, 'NCHAR', ATO.NAME),    
  112, DECODE(A.CHARSETFORM, 2, 'NCLOB', ATO.NAME),    
  ATO.NAME) at_typecode,    
  DECODE(BITAND(AT.PROPERTIES, 64), 64, NULL, ATU.NAME) at_properties, NULL,     
  A.ATTR_TOID,    
  DECODE(BITAND(T.PROPERTIES, 65536), 65536, 'NO', 'YES') t_properties,    
  SU.NAME, SO.NAME    
  FROM SYS.ATTRIBUTE$ A,     
  SYS.TYPE$ T, SYS.TYPE$ AT,    
  SYS."_CURRENT_EDITION_OBJ" ATO, SYS.USER$ ATU,     
  SYS."_CURRENT_EDITION_OBJ" SO, SYS.USER$ SU    
  WHERE T.TVOID = TYPOID    
  AND A.ATTR_TOID = ATO.OID$ AND    
  ATO.OWNER# = ATU.USER# AND    
  A.TOID = T.TVOID AND    
  T.PACKAGE_OBJ# IS NULL AND    
  AT.TVOID = A.ATTR_TOID AND    
  AT.SUPERTOID = SO.OID$ (+) AND SO.OWNER# = SU.USER# (+)    
  ORDER BY ATTRIBUTE#;

#### 子类型元数据信息

查询SQL，参考Oracle：

|  
|字段|说明|
|---|---|---|
|1|1|固定值，  1，image format（Oracle的数据格式标志）|
|2|SYS.USER$.NAME|子类型owner的名称|
|3|SYS."_CURRENT_EDITION_OBJ".NAME|子类型名称|
|4|SYS."_CURRENT_EDITION_OBJ".OID$|子类型的type oid|


  


OPEN SUBTYPE_RC FOR    
  SELECT /*+ NOPARALLEL */ 1, U.NAME, O.NAME, O.OID$    
  FROM SYS."_CURRENT_EDITION_OBJ" O,     
  SYS.USER$ U, SYS.TYPE$ T    
  WHERE T.SUPERTOID = TYPOID    
  AND T.TVOID = O.OID$ AND     
  O.SUBNAME IS NULL AND     
  O.OWNER# = U.USER#;

  


子类型结果集只包含直接子类型信息，不包含子类型的子类型信息。子类型信息在Oracle扩展接口TypeDescriptor中用于元数据展示。

列的元数据信息只有超类型的，如果实际数据是子类型的，数据中会携带子类型toid，使用子类型toid再查询一次子类型元数据信息。

  


  


内部实现方式，临时function：

create or replace function temp_get_type_shape(fullTypeName in out varchar, toid out bigint, tVersion out int, tds out raw, instantiable out varchar,     
  supOwner out varchar, supName out varchar, attrCursor out sys_refcursor, subTypeCursor out sys_refcursor) return int is    
  tdsFlag int := 0;    
  typeOid bigint := 0;    
  tdsInfo raw(8000);    
  ATTR_RC sys_refcursor;    
  SUBTYPE_RC sys_refcursor;    
  begin    
  SELECT T.TOID, T.VERSION#, DECODE(BITAND(T.PROPERTIES, 8), 8, 'YES', 0, 'NO'), SU.NAME, SO.NAME    
  into typeOid, tVersion, instantiable, supOwner, supName    
  FROM SYS.USER$ U, SYS.OBJ$ O, SYS.TOID$ OT, SYS.TYPE$ T LEFT JOIN SYS.TOID$ STO ON STO.TOID = T.SUPERTOID     
  LEFT JOIN SYS.OBJ$ SO ON STO.OBJ# = SO.OBJ# LEFT JOIN SYS.USER$ SU ON SO.OWNER# = SU.USER#    
  WHERE O.OWNER# = U.USER# AND O.OBJ# = OT.OBJ# AND OT.TOID = T.TOID AND O.SUBNAME IS NULL AND U.NAME||'.'||O.NAME = fullTypeName;    
    
  toid := typeOid;    
  tdsInfo := hextoraw('EF');    
  tds := tdsInfo;    
    
  open ATTR_RC for    
  SELECT 1, A.NAME, A.ATTRIBUTE#,    
  DECODE(A.ATTR_TOID, 0, 'UNKNOWN', 1, 'BOOLEAN', 2, 'TINYINT', 3, 'SMALLINT', 4, 'INTEGER', 5, 'BIGINT',    
  6, 'UTINYINT', 7, 'USMALLINT', 8, 'UINTEGER', 9, 'UBIGINT', 10, 'FLOAT' , 11, 'DOUBLE',    
  12, 'NUMBER', 13, 'DATE', 14, 'SHORTDATE', 15, 'TIME', 16, 'TIMESTAMP', 17, 'TIMESTAMP_TZ',    
  18, 'TIMESTAMP_LTZ', 19, 'INTERVAL YEAR TO MONTH', 20, 'INTERVAL DAY TO SECOND', 24, 'CHAR', 25, 'NCHAR', 26, 'VARCHAR',    
  27, 'NVARCAHR', 28, 'RAW', 29, 'CLOB', 30, 'BLOB', 31, 'BIT', 32, 'ROWID', 35, 'JSON', AO.NAME),    
  DECODE(BITAND(A.PROPERTIES, 1), 1, AU.NAME, NULL),    
  A.ATTR_TOID,    
  DECODE(BITAND(T.PROPERTIES, 8), 8, 'YES', 0, 'NO') as attrTypIns,    
  SU.NAME SUP_TYP_OWNER, SO.NAME SUP_TYP_NAME    
  FROM SYS.ATTRIBUTE$ A LEFT JOIN SYS.TOID$ ATO ON ATO.TOID = A.ATTR_TOID LEFT JOIN SYS.OBJ$ AO ON ATO.OBJ# = AO.OBJ#     
  LEFT JOIN SYS.USER$ AU ON AU.USER# = AO.OWNER# LEFT JOIN SYS.TYPE$ AT ON A.ATTR_TOID = AT.TOID LEFT JOIN SYS.TOID$ ASTO ON ASTO.TOID = AT.SUPERTOID     
  LEFT JOIN SYS.OBJ$ SO ON ASTO.OBJ# = SO.OBJ# LEFT JOIN SYS.USER$ SU ON SO.OWNER# = SU.USER#, SYS.TYPE$ T    
  WHERE T.TOID = typeOid AND A.TOID = typeOid AND T.PACKAGE_OBJ# IS NULL;    
  attrCursor := ATTR_RC;    
    
  OPEN SUBTYPE_RC FOR    
  SELECT 1, U.NAME, O.NAME, T.TOID    
  FROM SYS.OBJ$ O, SYS.USER$ U, SYS.TYPE$ T LEFT JOIN SYS.TOID$ STO ON T.TOID = STO.TOID    
  WHERE T.SUPERTOID = typeOid AND O.OBJ# = STO.OBJ# AND O.SUBNAME IS NULL AND O.OWNER# = U.USER#;    
  subTypeCursor := SUBTYPE_RC;

return tdsFlag;    
  end;    
  /

  


### UDT类型数据传输协议

  


#### object类型

|totalDataLen(u32)|||
|:---:|---|---|
|udtProtocolVersion(u8)|||
|prefixFlag（u8）|||
|utdType(u16: 4)|isFinal(u16:1)|unused(u16: 11)|
|attrCount(u8+u32)|||
|toid(u8 + u64)|||
|attrsDataSize(u8 or u8+u16 or u8+u32)|||
|attrData|||


  


  


如果object类型数据超过32*1024字节，使用stream协议发送。

  


**udt内部的size表示格式（区别于rowSize）**  ：

取第一个字节value

if value <= 0xFA then  value表示size, 长度1字节

else if value = 0xFB then value只是flag, value后两字节为长度

else if value = 0xFC then value只是flag, value后四字节为长度

  


attributeCount 类型为uint32,  序列化方法参考size序列化

如果isFinal是false，则需要序列化toid，toid类型为uint64, 以bytes方式序列化

如果attribute为标量，则以bytes方式序列化

如果attribute为udt，则先序列化udt得到一个bytes，然后再序列化该bytes

  


#### varray/nested table类型

|totalDataLen(u32)|||
|:---:|---|---|
|udtProtocolVersion(u8)|||
|prefixFlag（u8）|||
|utdType(u16: 4)|isFinal(u16:1)|unused(u16: 11)|
|elemCount(u8 or u8+u16 or u8+u32)|||
|elemLimit(u8 or u8+u16 or u8+u32)|||
|elemDataSize(u8 or u8+u16 or u8+u32)|||
|elemData|||


  


**prefixFlag**

array/nested table 数据是否是 inline，如果不是表示走Blob，此时数据是loblocator

  


elementCount类型为uint32,  序列化方法参考size序列化

elementLimit 类型为uint32,   序列化方法参考size序列化

数组元素序列化

无论数组元素是标量类型还是udt类型，元素都是以size + data，参考bytes序列化， 如果元素为null，则序列化为0xFF。

如果数组元素为标量类型：data即为实际数据

如果数组元素为udt类型, 则data为udt序列化之后的数据。

  


udt存储格式：    [udt存储结构设计](https://conf.yasdb.com/pages/viewpage.action?pageId=109586794)  

  


  


**入参绑定**

createStruct，必须指定object type name

createArray，必须指定array type name（对齐Oracle，提供扩展接口；对于原生createArrayOf不支持）

{toid + data}

  


  


###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#51-architecture%E6%9E%B6%E6%9E%84)  

  


###   [5.2 DFX设计](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#52-dfx%E8%AE%BE%E8%AE%A1)  

  


###   [5.3 其他](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#53-%E5%85%B6%E4%BB%96)  

根据特性开发的种类，有不同的涉及相关项, 如下示例，不同的特性种类关心范围有所差异，需要根据特性种类来扩展：

**涉及数据库语法开发，需要考虑系统权限和系统审计。**

**涉及数据库对象的特性开发，需要考虑对象级权限、对象级审计、对象安全访问和主备同步实现。**

##   [6. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

  


## 7. 自测用例

### 测试场景

1. udt object 作为表列，查询，结果集获取；

2. udt object as attr of object，查询，结果集获取；

3. udt array of scalar type, 查询，结果集获取；

4. udt array of udt object, 查询，结果集获取；

5. udt nested table of scalar type, 查询, 结果集获取；

6. udt nested table of udt object, 查询, 结果集获取；

7. udt object, as binding parameter；

8. udt array of scalar type, as binding parameter；

9. udt array of udt object, as binding parameter；

10. nested table of scalar type, as binding parameter；

11. nested table of object type, as binding parameter;

12. 通过connection接口 createStruct，创建客户端struct；

13. 通过connection扩展接口 createArrayOf，创建客户端array；

14. 类型失效（yashan目前暂不支持alter type；create or replace type没有表列引用时才能执行，因此暂不涉及）；

15. udt paramaer 作为存储过程入参、出参，返回值；

16. 自定义Java Class TypeMap，入参、出参、结果集场景下的自动映射；

17. 大数据量udt，触发内部lob传输；

18. 版本兼容性（升级了prepare协议），交叉连接覆盖。

  


## 8    [. ](https://conf.yasdb.com/pages/viewpage.action?pageId=91781152#6-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)    参考文档

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/Oracle-object-types.html#GUID-5905674A-A045-40B1-96DE-726761517D50](https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/Oracle-object-types.html#GUID-5905674A-A045-40B1-96DE-726761517D50)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-TYPE.html#GUID-E72E3EE6-DE95-4F58-8941-E2F76D0EAE80](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/CREATE-TYPE.html#GUID-E72E3EE6-DE95-4F58-8941-E2F76D0EAE80)  

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/ALTER-TYPE-statement.html#GUID-A8B449E7-E3A8-48F4-A4C6-5BB87B1841CD](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/ALTER-TYPE-statement.html#GUID-A8B449E7-E3A8-48F4-A4C6-5BB87B1841CD)  

### 元数据获取

//Oracle JDBC通过如下plsql获取到 udt 属性信息 （accessor:: initMetadata）

begin :1 := sys.dbms_pickler.get_type_shape(:2,:3,:4,:5,:6,:7,:8,:9,:10); end;

**高级包功能描述**  ：

describe dbms_pickler    
  FUNCTION GET_FORMAT RETURNS BINARY_INTEGER    
  Argument Name Type In/Out Default?    
  ------------------------------ ----------------------- ------ --------    
  FDO RAW OUT    
  FUNCTION GET_TYPE_SHAPE RETURNS BINARY_INTEGER    
  Argument Name Type In/Out Default?    
  ------------------------------ ----------------------- ------ --------    
  SCHEMA VARCHAR2 IN    
  TYPNAM VARCHAR2 IN    
  TYPOID RAW OUT    
  VERSION BINARY_INTEGER OUT    
  TDS LONG RAW OUT    
  LDS LONG RAW OUT    
  FUNCTION GET_TYPE_SHAPE RETURNS BINARY_INTEGER    
  Argument Name Type In/Out Default?    
  ------------------------------ ----------------------- ------ --------    
  SCHEMA VARCHAR2 IN    
  TYPNAM VARCHAR2 IN    
  TYPOID RAW OUT    
  VERSION BINARY_INTEGER OUT    
  TDS BLOB OUT    
  LDS LONG RAW OUT    
  FUNCTION GET_TYPE_SHAPE RETURNS BINARY_INTEGER    
  Argument Name Type In/Out Default?    
  ------------------------------ ----------------------- ------ --------    
  FULLTYPENAME VARCHAR2 IN/OUT    
  TYPOID RAW OUT    
  VERSION BINARY_INTEGER OUT    
  TDS LONG RAW OUT    
  INSTANTIABLE VARCHAR2 OUT    
  SUPERTYPE_OWNER VARCHAR2 OUT    
  SUPERTYPE_NAME VARCHAR2 OUT    
  ATTR_RC REF CURSOR OUT    
  SUBTYPE_RC REF CURSOR OUT    
  FUNCTION GET_TYPE_SHAPE RETURNS BINARY_INTEGER    
  Argument Name Type In/Out Default?    
  ------------------------------ ----------------------- ------ --------    
  FULLTYPENAME VARCHAR2 IN/OUT    
  TYPOID RAW OUT    
  VERSION BINARY_INTEGER OUT    
  TDS BLOB OUT    
  INSTANTIABLE VARCHAR2 OUT    
  SUPERTYPE_OWNER VARCHAR2 OUT    
  SUPERTYPE_NAME VARCHAR2 OUT    
  ATTR_RC REF CURSOR OUT    
  SUBTYPE_RC REF CURSOR OUT    
  FUNCTION UPDATE_THROUGH_REF RETURNS BINARY_INTEGER    
  Argument Name Type In/Out Default?    
  ------------------------------ ----------------------- ------ --------    
  PRF RAW IN    
  VERSION BINARY_INTEGER IN    
  TOID RAW IN    
  IMAGE LONG RAW IN

SQL>

  


  


#### 元数据缓存

Oracle JDBC 对于用户自定义的Struct、Array元数据信息自动缓存；如果服务端更新了UDT定义会导致缓存失效，则JDBC会抛出SQLException 。

  


Oracle JDBC提供自定义的  StructDescriptor 类，用于描述类型元数据信息；

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/Oracle-object-types.html#GUID-BE316A98-BAAD-4B15-A8DA-D9E081E9F2D4](https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/Oracle-object-types.html#GUID-BE316A98-BAAD-4B15-A8DA-D9E081E9F2D4)  

  


其他分析：

  [http://ksun-oracle.blogspot.com/2017/05/jdbc-oracle-objectcollection.html](http://ksun-oracle.blogspot.com/2017/05/jdbc-oracle-objectcollection.html)  

  


### 数据解析

关键class    
  PickleContext    
  StructDescriptor::toArray    
  this.pickler.unlinearize() //解析udt数据

**数据解析使用UDT自定义格式**

  [http://www.dba-oracle.com/t_pickler_fetch.htm](http://www.dba-oracle.com/t_pickler_fetch.htm)  

what is COLLECTION ITERATOR PICKLER FETCH?

**Answer:**  ** **   In general, a pickler fetch is the process of converting a packed array into a displayable format.  For more details on Oracle object-oriented database, see my notes on       [Oracle objects](http://www.google.com/search?&q=oracle+object-oriented+burleson)    .

Oracle consultant       [Steve Adams](http://www.ixora.com.au/q+a/0105/11195636.htm)       notes that the collection iterator with a pickler fetch is used to un-pack object type table columns:

> "Pickling is serializing arbitrary object-oriented data structures.  That is, converting them into a byte stream for storage, transmission over a network or iterative navigation as in this case.  It is a more complex process than you might imagine.  If you want more information, search the web for information on Python's pickle module.    
    
  I guess this is the way Oracle dereferences the embedded collections?"

  


#### 协议格式

typedef stUd  tDataMe  sg {

    byte udtCategory;  //format type

    byte version; //version num

    byte totalDataLen; //数据总长 类似row size，参考yashan的row size，可以用253特殊字扩展至2byte

    byte[16] toid;           //如果数据是子类型的，携带toid

    //之后的数据都是 size +data ，直到end； n * {size + data}

    byte dataLen1; 

    byte[dataLen1] datas;

    ...

} UdtAttrMesg;

  


typedef stArrayDataMesg {

    byte udtCategory; //format type, struct or collection type

    byte version; //version num

    byte totalDataLen; //数据总长，可扩展

    byte readLen; //

    byte prefixFlag; // array 数据是否是 inline，如果不是表示走Blob，此时数据是loblocator

    byte colectionFlag; //array(用0表示) or nested table

    byte elementCount; //数组实际元素个数，类似row size，参考yashan的row size，可以用253特殊字扩展至2byte

    //之后的数据都是 size +data ，直到end； n * {size + data}

    byte dataLen1

    byte[dataLen1] datas;

    ...

}

  


typedef stNestTableDataMesg {

    byte udtCategory; //format type, struct or collection type

    byte version; //version num

    byte  totalDataLen; //可扩展， (1+4个字节，用245标志后面的4个字节表示长度)

    byte readLen; // inlilne data offset（从当前位置开始，+(readLen-1) 个偏移后是inline数据，减一是因为固定有prefixFlag）

    byte prefixFlag; //nested table 是否是 inline，如果不是表示走Blob，此时数据是loblocator

    byte colectionFlag; //array or nested table (用0表示array 或 nested table) 

    byte elementCont; //nesttable实际元素个数，可扩展5字节表示元素个数

    //之后的数据都是 size +data ，直到end； n * {size + data}

    byte dataLen1

    byte[dataLen1] datas;

    ...

}

  


#### 数据缓存

oracle.sql.STRUCT 提供 public void setAutoBuffering(boolean enable) 方法开启类型属性自动缓存；将UDT类型数据缓存在客户端JVM内存中。

When you enable auto-buffering, the       `oracle.sql.STRUCT`       object keeps a local copy of all the converted attributes. 

This data is retained so that subsequent access of this information does not require going through the data format conversion process.

  


  


  


## Attachments: