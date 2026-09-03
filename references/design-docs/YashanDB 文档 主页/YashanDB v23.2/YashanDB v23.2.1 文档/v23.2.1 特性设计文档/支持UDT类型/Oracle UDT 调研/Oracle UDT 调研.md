Created by 苏文, last modified on 五月 15, 2023

### Oracle 调研

  


用例：

CREATE TYPE person_typ AS OBJECT (    
  idno NUMBER,    
  name VARCHAR2(20),    
  phone VARCHAR2(20),    
  MAP MEMBER FUNCTION get_idno RETURN NUMBER,    
  MEMBER PROCEDURE display_details ( SELF IN OUT NOCOPY person_typ ));    
  /

CREATE TYPE BODY person_typ AS    
  MAP MEMBER FUNCTION get_idno RETURN NUMBER IS    
  BEGIN    
  RETURN idno;    
  END;    
  MEMBER PROCEDURE display_details ( SELF IN OUT NOCOPY person_typ ) IS    
  BEGIN    
  -- use the PUT_LINE procedure of the DBMS_OUTPUT package to display details    
  DBMS_OUTPUT.PUT_LINE(TO_CHAR(idno) || ' ' || name);    
  END;    
  END;    
  /

CREATE TABLE contacts (    
  contact person_typ,    
  contact_date DATE );

INSERT INTO contacts VALUES (    
  person_typ (65, 'Verna', '1-650-555-0125'),    
  date'2023-03-28');    
    
  INSERT INTO contacts VALUES (    
  person_typ (66, 'Linda', '1-650-555-0126'),    
  date'2023-03-28');

INSERT INTO contacts VALUES (    
  person_typ (67, 'Josefy', '1-650-555-0127'),    
  date'2023-03-28');

  


oracle 元数据查询SQL:

this.initMetaData1_9_0_SQL = new String[]{"    
  SELECT INSTANTIABLE, supertype_owner, supertype_name, LOCAL_ATTRIBUTES FROM all_types    
  WHERE type_name = :1 AND owner = :2 ",    
  "DECLARE \n bind_synonym_name user_synonyms.synonym_name%type := :1; \n    
  the_table_owner user_synonyms.table_owner%type; \n    
  the_table_name user_synonyms.table_name%type; \n    
  the_db_link user_synonyms.db_link%type; \n    
  sql_string VARCHAR2(1000); \n    
  BEGIN \n SELECT TABLE_NAME, TABLE_OWNER, DB_LINK INTO \n the_table_name, the_table_owner, the_db_link \n    
  FROM USER_SYNONYMS WHERE \n SYNONYM_NAME = bind_synonym_name; \n \n    
  sql_string := 'SELECT INSTANTIABLE, SUPERTYPE_OWNER, SUPERTYPE_NAME, LOCAL_ATTRIBUTES FROM ALL_TYPES'; \n \n    
  IF the_db_link IS NOT NULL \n    
  THEN \n sql_string := sql_string || '@' || the_db_link; \n END IF; \n    
  sql_string := sql_string || ' WHERE TYPE_NAME = ''' || the_table_name || ''' AND OWNER = ''' || the_table_owner || ''''; \n    
  OPEN :2 FOR sql_string; \nEND;",    
  "DECLARE \n    
  bind_synonym_name user_synonyms.synonym_name%type := :1; \n    
  the_table_owner user_synonyms.table_owner%type; \n the_table_name user_synonyms.table_name%type; \n the_db_link user_synonyms.db_link%type; \n    
  sql_string VARCHAR2(1000); \nBEGIN \n    
  SELECT TABLE_NAME, TABLE_OWNER, DB_LINK INTO \n    
  the_table_name, the_table_owner, the_db_link \n FROM ALL_SYNONYMS WHERE \n OWNER = 'PUBLIC' AND \n SYNONYM_NAME = bind_synonym_name; \n \n    
  sql_string := 'SELECT INSTANTIABLE, SUPERTYPE_OWNER, SUPERTYPE_NAME, LOCAL_ATTRIBUTES FROM ALL_TYPES'; \n \n    
  IF the_db_link IS NOT NULL \n THEN \n sql_string := sql_string || '@' || the_db_link; \n END IF; \n    
  sql_string := sql_string || ' WHERE TYPE_NAME = ''' || the_table_name || ''' AND OWNER = ''' || the_table_owner || ''''; \n OPEN :2 FOR sql_string; \nEND;"};

  


### 元数据获取

//Oracle JDBC通过如下plsql获取到 udt 属性信息 （accessor:: initMetadata）

1 对于UDT类型，列信息中返回 full type name；

2 通过高级包sys.dbms_pickler.get_type_shape 获取完整元数据信息；其中第一个参数为入参，即：full type name

  


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

typedef stUdtDataMesg {

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

  


### UDT相关类型

1 对象类型

create or replace type

2 子类型

  


3 引用 Ref

CREATE TYPE emp_person_typ AS OBJECT (    
  name VARCHAR2(30),    
  manager REF emp_person_typ );    
  /    
  CREATE TABLE emp_person_obj_table OF emp_person_typ;

INSERT INTO emp_person_obj_table VALUES (    
  emp_person_typ ('John Smith', NULL));    
    
  INSERT INTO emp_person_obj_table    
  SELECT emp_person_typ ('Bob Jones', REF(e))    
  FROM emp_person_obj_table e    
  WHERE       [e.name](http://e.name/)       = 'John Smith';

  


引用类型也可以是一个 对象表或者子类型

A       `REF`       can be scoped to an object table of the declared type (    `person_typ`       in the example) or of any subtype of the declared type.

If a       `REF`       is scoped to an object table of a subtype, the       `REF`       column is effectively constrained to hold only references to instances of the subtype (and its subtypes, if any) in the table..

  


4 集合类型

  Varrays

  Nested Tables

  多级嵌套集合类型

CREATE TYPE person_typ AS OBJECT (    
  id int,    
  name1 VARCHAR2(30),    
  name2 VARCHAR2(20));    
  /

CREATE TYPE people_typ AS TABLE OF person_typ;    
  /

CREATE TABLE people_tab (    
  group_no NUMBER,    
  people_column people_typ )    
  NESTED TABLE people_column STORE AS people_column_nt;

INSERT INTO people_tab VALUES (    
  100,    
  people_typ( person_typ(1, 'aaaaa', 'bbbbb'),    
  person_typ(2, 'ccccc', 'ddddd')));    
  INSERT INTO people_tab VALUES (    
  101,    
  people_typ( person_typ(3, 'eeeee', 'fffff'),    
  person_typ(4, 'ggggg', 'hhhhh')));

  


### 多态子类型

  


  


  


### 绑定入参

1 需要调用Connection.createSturct 接口显示创建Struct实例

2 通过PreparedStatement.setObject(paramIndex, structInstance, Types.STRUCT) 接口设置入参

  


The Java object can be an instance of the       `STRUCT`       class or an instance of the class implementing either the       `SQLData`       or       `OracleData`       interface.

Oracle JDBC driver will convert the Java object into the linearized format acceptable to the database SQL engine. Binding a subtype object is the same as binding a standard object.

  [https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/Oracle-object-types.html#GUID-B7A9E9B9-ED8B-4EBA-94F1-C048876DB314](https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/Oracle-object-types.html#GUID-B7A9E9B9-ED8B-4EBA-94F1-C048876DB314)  

### Java Class 类型映射

用户自定义的映射class 需要实现java.sql.SQLData接口

其中 

void   readSQL   (SQLInput stream  ,   String typeName)   throws   SQLException  ;

void     writeSQL     (SQLOutput stream)     throws     SQLException  ;    
  表示与SQLInput流的读写交互    
    [https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/Oracle-object-types.html#GUID-26AC0C12-D473-4957-A9B1-D64DFD0EC71B](https://docs.oracle.com/en/database/oracle/oracle-database/19/jjdbc/Oracle-object-types.html#GUID-26AC0C12-D473-4957-A9B1-D64DFD0EC71B)  

SQLInput/SQLOutput流提供对UDT类型的流式读写，只用于配合java.sql.SQLData的接口使用。

  


### 测试场景

1 UDT作为表列；

2 UDT作为UDT属性；

3 UDT作为绑定参数；

4 UDT作为存储过程入参、出参，返回值

  


## Attachments:

[oracle调研.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODNhMWFkOWEzMzExZGM4YWVkIiwicmVmX2lkIjoiNjczOTZjODM3MjgyMDZlZmI5MmYxMzc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMjE3LCJleHAiOjE3ODIzODc2MTd9.QO-kCNA2rUji14cAfYyyMIeBiBtEw92P6Iigpo8pQ2Y)

 (text/plain)    


[oracle-udt.txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjODM4OTcwYzJhZjRmNTIwYzdlIiwicmVmX2lkIjoiNjczOTZjODM3MjgyMDZlZmI5MmYxMzc5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAxMjE3LCJleHAiOjE3ODIzODc2MTd9.2xwhHuzKLJtSLJCfkaRiFLMmWQU3wjYuDRin3vm6BNI)

 (text/plain)    
