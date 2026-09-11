Created by 冯皓博, last modified on 十一月 14, 2023

### C驱动：

1、新增数据库描述类型  YAC_TYPE_NUMERIC_FLOAT

**测试点：**

调用yacColAttribute获取YAC_COL_ATTR_TYPE为YAC_TYPE_NUMERIC_FLOAT

### ODBC驱动：·

1、新增数据库描述类型  SQL_FLOAT  ，use_native_type关时，遇到数据库类型时float(xx)类型，SQLColAttribute的  SQL_COL_ATTR_TYPE显示为SQL_FLOAT类型  （确认了，看新变更）

**测试点：**

调用SQLColAttribute获取SQL_COL_ATTR_TYPE为SQL_FLOAT

### OCI驱动：

1、数据库描述类型无新增，use_native_type关时，遇到数据库类型时float(xx)类型，使用OCIAttrGet查询OCI_ATTR_DATA_TYPE显示为OCI_TYPECODE_NUMBER

2、OCIDescribeAny函数新增在use_native_type关时对float(xx)和binary_float的描述，针对这两种类型，float(xx)返回OCI_TYPECODE_NUMBER，binary_float返回OCI_TYPECODE_BFLOAT

**测试点：**

1、使用OCIAttrGet查询OCI_ATTR_DATA_TYPE，遇到数据库类型时float(xx)类型时显示为OCI_TYPECODE_NUMBER

2、使用OCIDescribeAny查询OCI_ATTR_DATA_TYPE，遇到数据库类型时float(xx)类型时显示为OCI_TYPECODE_NUMBER，遇到binary_float类型时显示为OCI_TYPECODE_BFLOAT，遇到tinyint/binary_tinyint、smallint/binary_smallint、int/binary_int、bigint/binary_bigint返回OCI_TYPECODE_INTEGER

### YASQL：

1、desc 表遇到float(xx)类型，要精确显示FLOAT(xx)，遇到tinyint/binary_tinyint、smallint/binary_smallint、int/binary_int、bigint/binary_bigint，都显示非binary_前缀类型（临时方案，后续可能要变更）

2、支持查询FLOAT(xx)类型的数据

**测试点：**

调用desc测试

查询FLOAT(xx)类型的数据

### JDBC：

1、getColumns接口的类型名直接从视图里插，jdbc type 要新加一个BINARY_FLOAT。

2、getTypeInfo里加上binary_那些。

3、resultSetMetaData.getColumnTypeName，Oracle的FLOAT对应NUMBER

**测试点：**

getColumns接口和getColumnTypeName接口

### python驱动：

1、数据库描述类型无新增，遇到数据库类型时float(xx)类型，描述类型为number类型

**测试点：**

遇到数据库类型时float(xx)类型，描述类型为number类型