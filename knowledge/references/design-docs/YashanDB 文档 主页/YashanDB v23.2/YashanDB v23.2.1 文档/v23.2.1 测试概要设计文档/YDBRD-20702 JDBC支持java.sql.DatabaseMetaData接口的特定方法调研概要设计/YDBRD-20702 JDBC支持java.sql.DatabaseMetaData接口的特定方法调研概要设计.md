Created by 李潮 on 十月 12, 2024

**目的：**    
  1.牵引TSE理解特性，熟悉特性的主要能力、规格、约束、应用场景等    
  2.牵引TSE在研发设计评审中能给出有效意见(如识别特性行为、规格、约束与友商的重大差异，关联能力缺漏)    
  3.给测试概要设计和测试详细设计做输入

# 1. 需求概述

IR：    [YDBRD-20702](https://jira.yasdb.com/browse/YDBRD-20702?src=confmacro)    -  JDBC支持java.sql.DatabaseMetaData接口的特定方法  完成

1、支持JDBC接口java.sql.DatabaseMetaData方法getUDTs(String catalog,String schemaPattern, String typeNamePattern,int[] types)    
  2、支持JDBC接口java.sql.DatabaseMetaData方法getSuperTypes(String catalog,String schemaPattern,String typeNamePattern)

# 2. 友商的实现情况

  


通用的 jdbc api

  


- #### getUDTs
-   [ResultSet](https://docs.oracle.com/javase/8/docs/api/java/sql/ResultSet.html)     getUDTs(    [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     catalog,    [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     schemaPattern,    [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     typeNamePattern,int[] types)throws     [SQLException](https://docs.oracle.com/javase/8/docs/api/java/sql/SQLException.html)  
- Retrieves a description of the user-defined types (UDTs) defined in a particular schema. Schema-specific UDTs may have type       `JAVA_OBJECT`    ,       `STRUCT`    , or       `DISTINCT`    .
- Only types matching the catalog, schema, type name and type criteria are returned. They are ordered by       `DATA_TYPE`    ,       `TYPE_CAT`    ,       `TYPE_SCHEM`       and       `TYPE_NAME`    . The type name parameter may be a fully-qualified name. In this case, the catalog and schemaPattern parameters are ignored.
- Each type description has the following columns:
-     1. **TYPE_CAT**     String       `=>`       the type's catalog (may be       `null`    )
    1. **TYPE_SCHEM**     String       `=>`       type's schema (may be       `null`    )
    1. **TYPE_NAME**     String       `=>`       type name
    1. **CLASS_NAME**     String       `=>`       Java class name
    1. **DATA_TYPE**     int       `=>`       type value defined in java.sql.Types. One of JAVA_OBJECT, STRUCT, or DISTINCT
    1. **REMARKS**     String       `=>`       explanatory comment on the type
    1. **BASE_TYPE**     short       `=>`       type code of the source type of a DISTINCT type or the type that implements the user-generated reference type of the SELF_REFERENCING_COLUMN of a structured type as defined in java.sql.Types (    `null`       if DATA_TYPE is not DISTINCT or not STRUCT with REFERENCE_GENERATION = USER_DEFINED)

- **Note:**     If the driver does not support UDTs, an empty result set is returned.
- Parameters:catalog - a catalog name; must match the catalog name as it is stored in the database; "" retrieves those without a catalog; null means that the catalog name should not be used to narrow the searchschemaPattern - a schema pattern name; must match the schema name as it is stored in the database; "" retrieves those without a schema; null means that the schema name should not be used to narrow the searchtypeNamePattern - a type name pattern; must match the type name as it is stored in the database; may be a fully qualified nametypes - a list of user-defined types (JAVA_OBJECT, STRUCT, or DISTINCT) to include; null returns all typesReturns:ResultSet object in which each row describes a UDTThrows:SQLException - if a database access error occursSince:1.2See Also:getSearchStringEscape()


  


- #### getSuperTypes
-   [ResultSet](https://docs.oracle.com/javase/8/docs/api/java/sql/ResultSet.html)     getSuperTypes(    [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     catalog,    [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     schemaPattern,    [String](https://docs.oracle.com/javase/8/docs/api/java/lang/String.html)     typeNamePattern)throws     [SQLException](https://docs.oracle.com/javase/8/docs/api/java/sql/SQLException.html)  
- Retrieves a description of the user-defined type (UDT) hierarchies defined in a particular schema in this database. Only the immediate super type/ sub type relationship is modeled.
- Only supertype information for UDTs matching the catalog, schema, and type name is returned. The type name parameter may be a fully-qualified name. When the UDT name supplied is a fully-qualified name, the catalog and schemaPattern parameters are ignored.
- If a UDT does not have a direct super type, it is not listed here. A row of the       `ResultSet`       object returned by this method describes the designated UDT and a direct supertype. A row has the following columns:
-     1. **TYPE_CAT**     String       `=>`       the UDT's catalog (may be       `null`    )
    1. **TYPE_SCHEM**     String       `=>`       UDT's schema (may be       `null`    )
    1. **TYPE_NAME**     String       `=>`       type name of the UDT
    1. **SUPERTYPE_CAT**     String       `=>`       the direct super type's catalog (may be       `null`    )
    1. **SUPERTYPE_SCHEM**     String       `=>`       the direct super type's schema (may be       `null`    )
    1. **SUPERTYPE_NAME**     String       `=>`       the direct super type's name

- **Note:**     If the driver does not support type hierarchies, an empty result set is returned.
- Parameters:catalog - a catalog name; "" retrieves those without a catalog; null means drop catalog name from the selection criteriaschemaPattern - a schema name pattern; "" retrieves those without a schematypeNamePattern - a UDT name pattern; may be a fully-qualified nameReturns:a ResultSet object in which a row gives information about the designated UDTThrows:SQLException - if a database access error occursSince:1.4See Also:getSearchStringEscape()


# 3. 示例

*友商的用法示例*

# 4. 参考文档

  [DatabaseMetaData (Java Platform SE 8 ) (oracle.com)](https://docs.oracle.com/javase/8/docs/api/java/sql/DatabaseMetaData.html)  

  


# 5. 后续关注(可选)

*后续测试设计与执行过程中需跟友商做细化对比的内容*