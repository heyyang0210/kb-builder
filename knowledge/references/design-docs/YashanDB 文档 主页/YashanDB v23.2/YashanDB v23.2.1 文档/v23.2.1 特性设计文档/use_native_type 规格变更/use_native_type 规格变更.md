Created by 冯皓博, last modified on 十一月 14, 2023

# use_native_type默认开

  


1、设置use_native_type = false后：

定义的tinyint/smallint/int/bigint直接转变成number, p = 38, scale = 0;     
  定义的float类型在内部被定义为DTYPE_NUMBER类型，存储使用number, precision = 126（二进制）, scale = -128，显示时仍然按float(126)显示，不会显示numeric_float(126)形式    
  定义的float(p)在内部被定义为DTYPE_NUMBER类型, 存储使用number, precision = p（二进制）, scale = -128，显示时仍然按float(p)显示，不会显示numeric_float(p)形式    
  其余类型保持不变

### 目前

|数据类型定义|C类型映射|内部宏映射|系统视图字符串映射|
|---|---|---|---|
|tinyint|原生char|DTYPE_TINYINT(2)|tinyint|
|smallint|原生short|DTYPE_SMALLINT(3)|smallint|
|int|原生int|DTYPE_INTEGER(4)|integer|
|bigint|原生long long|DTYPE_BIGINT(5)|bigint|
|float|原生float|DTYPE_FLOAT(10)|float|
|binary_tinyint|原生char|DTYPE_TINYINT(2)|tinyint|
|binary_smallint|原生short|DTYPE_SMALLINT(3)|smallint|
|binary_int|原生int|DTYPE_INTEGER(4)|integer|
|binary_bigint|原生long long|DTYPE_BIGINT(5)|bigint|
|binary_float|原生float|DTYPE_FLOAT(10)|float|


### use_native_type开

|数据类型定义|C类型映射|内部宏映射|系统视图字符串映射|
|---|---|---|---|
|tinyint|原生char|DTYPE_TINYINT(2)|tinyint|
|smallint|原生short|DTYPE_SMALLINT(3)|smallint|
|int|原生int|DTYPE_INTEGER(4)|integer|
|bigint|原生long long|DTYPE_BIGINT(5)|bigint|
|float|原生float|DTYPE_FLOAT(10)|float|
|binary_tinyint|原生char|DTYPE_TINYINT(2)|tinyint|
|binary_smallint|原生short|DTYPE_SMALLINT(3)|smallint|
|binary_int|原生int|DTYPE_INTEGER(4)|integer|
|binary_bigint|原生long long|DTYPE_BIGINT(5)|bigint|
|binary_float|原生float|DTYPE_FLOAT(10)|float|


### use_native_type关

|数据类型定义|C类型映射|内部宏映射|系统视图字符串映射|
|---|---|---|---|
|tinyint|number|DTYPE_NUMBER(12)|number|
|smallint|number|DTYPE_NUMBER(12)|number|
|int|number|DTYPE_NUMBER(12)|number|
|bigint|number|DTYPE_NUMBER(12)|number|
|float|number|DTYPE_NUMERIC_FLOAT  (40)|float|
|binary_tinyint|原生char|DTYPE_TINYINT(2)|binary_tinyint|
|binary_smallint|原生short|DTYPE_SMALLINT(3)|binary_smallint|
|binary_int|原生int|DTYPE_INTEGER(4)|binary_integer|
|binary_bigint|原生long long|DTYPE_BIGINT(5)|binary_bigint|
|binary_float|原生float|DTYPE_FLOAT(10)|binary_float|


### float适配规范：

|开关|数据类型定义|C类型映射|内部宏映射|系统视图字符串映射|
|---|---|---|---|---|
|开|float|原生float|DTYPE_FLOAT(10)|float|
|开|binary_float|原生float|DTYPE_FLOAT(10)|float|
|关|float|number|DTYPE_NUMERIC_FLOAT  (40)|float|
|关|binary_float|原生float|DTYPE_FLOAT(10)|binary_float|


根据宏可区分原生float和number    
  根据系统视图字符串无法区分原生float和number，需要额外通过系统视图data_precision字段来区分，  DTYPE_NUMERIC_FLOAT为126，DTYPE_FLOAT为NULL    


![](https://pingcode.yasdb.com/atlas/files/public/67396c2ca1ad9a3311dc8831/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTk0ODcsImV4cCI6MTc4MjMxMDI4N30.yK1I7m_49mW03uJIBhWtu_3VfYVlHTW2b9dtDf_7JcE)

适配建议：    
  1、原逻辑中查询系统视图数据类型字符串的逻辑都需要修改，使用tinyint、smallint、int、bigint类型做解码时都需要额外并上binary_类型，使用float需要单独处理：

如果precision字段为NULL，那么原建表语句是binary_float

如果precision字段不为NULL，那么建表语句是float()

2、原逻辑中判断内部数据类型宏的场景，需要新增对  DTYPE_NUMERIC_FLOAT的适配

## Attachments: