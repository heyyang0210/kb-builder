# YDBRD-37008：YASLDR支持导入GIS数据多个SRID

SR链接：  [https://pingcode.yasdb.com/pjm/items/6771f7bea9f31a27f6b0ce0f?](https://pingcode.yasdb.com/pjm/items/6771f7bea9f31a27f6b0ce0f?)  #YDBRD-37008 YASLDR支持导入GIS数据多个SRID

## ﻿  [ 1. 总述 ](https://pingcode.yasdb.com/#1-%E6%80%BB%E8%BF%B0)  ﻿

1. 当前YASLDR导入CSV格式的GIS数据时，一次导入只能使用参数指定一个SRID，实际上在创建表不定义SRID的时候，导入时可以/需要导入不同的SRID


### ﻿  [ 1.1 需求来源 ](https://pingcode.yasdb.com/#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  ﻿

  ymp迁移GIS数据

### ﻿  [ 1.2 调研文档 ](https://pingcode.yasdb.com/#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  ﻿

   调研PostgresSQL的数据库，其对应的copy支持导入导出GIS数据，但坐标系数据已经在GIS数据中体现，或者坐标系数据需要使用单独的列存储。

    PostgreSQL对应的shp2pgsql工具，仅支持文件级别的坐标系设置，不支持行级别的坐标系设置。

### ﻿  [ 1.3 需求分析 ](https://pingcode.yasdb.com/#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  ﻿

  支持导入的不同行具有不同的GIS坐标，且将这两者组合后导入表中的同一列，实质是需要支持CSV数据列上的函数计算。

 从方案设计的通用角度来说，也就是支持导入时针对导入列支持指定计算函数的功能。

### ﻿  [ 1.4 数据字典 ](https://pingcode.yasdb.com/#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  ﻿

### ﻿  [ 1.5 开源依赖 ](https://pingcode.yasdb.com/#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  ﻿

无

## ﻿  [ 2. 接口 ](https://pingcode.yasdb.com/#2-%E6%8E%A5%E5%8F%A3)  ﻿

  yasldr regress/regress  control_text="'load data OPTIONS(DEGREE_OF_PARALLELISM=6) infile '$YASDB_DATA/c5csv/c5csv_test_gis_load.csv' fields terminated by ',' append into table c5csv_test_gis_load (c1, c2 \"ST_GeomFromText(?,?) \")'"

## ﻿  [ 3. 规格与约束 ](https://pingcode.yasdb.com/#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  ﻿

  1） 本次仅支持ST_GeomFromText函数，参数个数在[1,2]之间，即不小于1且不大于2

  2）csv数据列的个数和导入语句中指定的表列及函数参数和的数目不一致时，其行为与当前行为保持一致（参见TRAILING NULLCOLS参数说明）

  3）不支持函数嵌套使用

  4）仅basic模式支持使用函数

  5）拆分文件split模式下不支持函数

## ﻿  [ 4. 特性 ](https://pingcode.yasdb.com/#4-%E7%89%B9%E6%80%A7)  ﻿

  要实现支持导入列上的函数计算，需要增加支持新的语法形式，在支持的语法形式中，对支持的函数进行效验。

### ﻿  [ 4.1 语法图](https://pingcode.yasdb.com/#41-st-makevalid)  

在当前column_clause语法的基础上，增加func_column_clause类型，用来实现支持指定列上的计算函数的功能

```  ebnf

= '(' (table_column_name (lob_column_clause|lls_column_clause|func_column_clause) |filler_column_clause)

{"," (table_column_name (lob_column_clause|lls_column_clause|func_column_clause)  |filler_column_clause) } ')'.  
  ```

![image.png](https://pingcode.yasdb.com/atlas/files/public/67ac697098ac295b69be0dbc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUNBQUFBQUFBQUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDU0MTEsImV4cCI6MTc4MjM1NjIxMX0.djMSVR3vyFdeho8w-V4tPW3rmXIl_Kmm2xAYsOpycFs)

###    [4.2 支持导入列上的GIS函数计算](https://pingcode.yasdb.com/#41-st-makevalid)  

支持导入列的列名后面设置计算函数，其语法形式如下（对应  func_column_clause  ）

```  ebnf    
= '"' func_name "(" func_arg {"," func_arg } ")" '"' .
  ```

![image.png](https://pingcode.yasdb.com/atlas/files/public/67ac69a0d6fcabebff225ac3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBUUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQ0FBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUNBQUFBQUFBQUFBQUFRQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzNDU0MTEsImV4cCI6MTc4MjM1NjIxMX0.djMSVR3vyFdeho8w-V4tPW3rmXIl_Kmm2xAYsOpycFs)

该语句仅可在BASIC导入模式下使用，用于设置当前列的计算函数。func_arg用来表示该函数的参数，使用?表示绑定参数，即对应CSV数据中的一列，亦可以指定为常量值。

## ﻿  [ 5. Testcases（自测用例） ](https://pingcode.yasdb.com/#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  ﻿

|测试项目|测试步骤|用例|预期结果|备注|
|---|---|---|---|---|
|不带GIS坐标数据，不使用GIS函数||||﻿  
|
|带GIS坐标数据，不使用GIS函数||||﻿  
|
|带GIS坐标数据，使用GIS函数||||﻿  
|
|不带GIS坐标数据，使用GIS函数||||﻿  
|
|使用其他函数|||||
|使用多次GIS函数|||||


## ﻿  [ 7. 工作量评估 ](https://pingcode.yasdb.com/#7-%E5%B7%A5%E4%BD%9C%E9%87%8F%E8%AF%84%E4%BC%B0)  ﻿

 开发工作量： 2人周

## ﻿  [ 8.资料设计章节 ](https://pingcode.yasdb.com/#8%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  ﻿

需要在《yasldr使用指导》页面添加支持的函数能力和使用限制说明。

## ﻿  [ 9.未来规划 ](https://pingcode.yasdb.com/#9%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  ﻿

实施本方案后，未来若想要支持更多的函数，如NVL，开发仅需将函数添加到白名单即可。



