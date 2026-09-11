Created by 钟溱, last modified on 十月 12, 2024

#   [YDBRD-23481](https://jira.yasdb.com/browse/YDBRD-23481?src=confmacro)    -  binary_double支持语法兼容  完成

# 1.   **概述**

数值类型后附字母d，表示将数据类型设置为binary_double 主要用于数值类型兼容；

数值类型后带字母d的时候，表示数据类型应设置为binary_double    
  在多种应用场景（如filter、column），都统一表示数值类型为binary_double

支持行存+列存（即单机、分布式、集群都支持）

# 2.   **需求分析**

- 需求分析详细见概要设计中有涉及，此处不重复赘述
- 开发设计的主要原理：


lexer解析中对于字符'd'/'D'做特殊处理，增加LNUM_DOUBLE作为lexer新数据类型标志    
  当number解析中出现'd'/'D'，将数据类型标志置为LNUM_DOUBLE，后续将把数据类型转换为binary_double处理

## 2.1表示说明

|SQL类型|格式|示例|说明|
|:---|:---|:---|:---|
|double    
    
    
    
    
    
    
    
    
    
    
    
    
    
|数值+D|89D|合法|
||数值+d|89d|合法|
||正数符号+数值+D/d|+89D/+89d|合法|
||负数符号+数值+D/d|-89D/-89d|合法|
||科学计数法的数值+D/d    
    
    
|8.9e+1D/8.9e+1d|合法|
|||8.9E+1D/8.9E+1d|合法|
|||8.9e1D/8.9e1d|合法|
|||8.9E1D/8.9E1d|合法|
||正负符号+科学计数法数值+D/d    
    
    
|+8.9e+1D/-8.9e+1d|合法|
|||+8.9E+1D/-8.9E+1d|合法|
|||+8.9e1D/-8.9e1d|合法|
|||+8.9E1D/-8.9E1d|合法|
||数值+D/d+D/d|89DD/89dd|非法报错|
||数值+D/d+数字|89D1/89d0|非法报错|
||数值+D/d+其他字符|89DE/89de/89D./89D.1/89D+/89D-/89D$等|非法报错|
||单引号内：数值+D/d|'89D'/'89d'|非法报错|
||数值+D/d||数值+D/d|89D||89d|非法报错|
|binary_double|同上|同上|同double，无区别|


## 2.2上述合法格式支持插入的数据类型（同原生double支持的一致）

|  
|数值+D/d|
|---|---|
|TINYINT|✓|
|SMALLINT|✓|
|INT|✓|
|BIGINT|✓|
|NUMBER|✓|
|FLOAT|✓|
|DOUBLE|✓|
|CHAR/VARCHAR|✓|
|NCHAR/NVARCHAR|✓|
|DATE|X|
|TIMESTAMP|X|
|YM_INTERVAL|X|
|DS_INTERVAL|X|
|TIME|X|
|BOOLEAN|X|
|CLOB|X|
|NCLOB|X|
|BLOB|X|
|XMLTYPE|X|
|BIT|X|
|RAW|X|
|JSON|X|
|ROWID/UROWID|X|


# 3.   **测试设计方法**

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计；

1、新增功能用例见下详细测试设计

2、  列表复用行表用例，在行表基础上调整用例后测试（覆盖单机、分布式、集群环境）

3、根际开发实现原理只是涉及前端解析，其他比如表操作、函数、plsql、高级包等都未涉及改动，因此对于各处涉及到double数据类型相关的只做简单覆盖，不做深入复杂场景测试；

重点还是在于：更新double类型列值时set的数据以’数值+D/d‘表示时，能够解析成功并插入的这种DML的数据类型场景

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|
|格式校验|/|覆盖上述2.1表示说明的合法格式|数值覆盖double的值域边界、0、和常规数值|覆盖上述2.1表示说明的非法格式|select XX from dual;（XX是有效等价类、无效等价类）,create table xx as select XX from dual;    
  desc xx；--查看数据类型，有效类都是double，无效类都是varchar|
|insert场景|insert into|上述2.1表示说明的合法格式插入表列，表列覆盖上述2.2的全部数据类型----select 查询数据正确|上述2.2支持插入的数据类型成功，不支持插入的数据类型则失败|上述2.1表示说明的非法格式插入表列，覆盖上述2.2的全部数据类型----插入报错|  
|
|update场景|update set|表列更新为上述2.1表示说明的合法格式，表列覆盖上述2.2的全部数据类型----select查询数据正确|上述2.2支持插入的数据类型成功，不支持插入的数据类型则失败|表列更新为上述2.1表示说明的非法格式，表列覆盖上述2.2的全部数据类型----更新报错|  
|
|函数覆盖|  
|聚集函数：,AVG、COUNT、MAX、MIN、SUM|  
|/|1、入参为’数值+D/d‘,2、不报错，按照对象正常返回|
|  
|  
|字符函数：,UPPER、POSITION、REPLACE、LEFT|  
|/|同上|
|  
|  
|数学函数：,ABS、MOD、FLOOR、EXP |  
|/|同上|
|  
|  
|转换函数：,cast as（覆盖全部数据类型）、TO_CHAR、TO_NUMBER|  
|/|同上|
|  
|  
|窗口函数：,FIRST_VALUE、ROW_NUMBER |  
|/|同上|


  


场景测试用例：

|输入条件|等价类|  
|
|:---|:---|:---|
|DDL,  
|create时作为char/varchar/nchar/nvarchar列的默认值带d/D|  
|
||create时作为NUMBER列的默认值带d/D|  
|
||create时作为float列的默认值带d/D|  
|
||create时作为double列的默认值带d/D|  
|
||create时作为BIT列的默认值带d/D|X|
||create时作为tinyint/samllint/int/bigint列的默认值带d/D|  
|
||create时作为date/TIMESTAMP/YM_INTERVAL/DS_INTERVAL/time列的默认值带d/D|X|
||create时作为boolean列的默认值带d/D|X|
||create时作为clob/nclob列的默认值带d/D|  
|
||create时作为clob/nclob/blob列的默认值带d/D|  
|
||create时作为xmltype列的默认值|X|
||create时作为raw列的默认值|X|
||create时作为rowid/urowid列的默认值|X|
||create时作为json列的默认值|X|
||alter时作为列的默认值  --覆盖的数据类型同上|  
|
||create时char/varchar/nchar/nvarchar的Size带d/D|  
|
||create时  NUMBER的p，s  带d/D|  
|
||create时  float的p  带d/D|  
|
||create时  float的m，d  带d/D|  
|
||create时double  的p  带d/D|  
|
||create时double  的m，d  带d/D|  
|
||create时BIT的Size带d/D|  
|
||create时Raw的Size带d/D|  
|
||create时  UROWID  的Size带d/D|  
|
|DML,  
|update|见上述update场景|
||insert|见上述insert场景|
|DQL,  
|作为select投影返回|上述格式校验的select XX from dual;已覆盖|
||作为where条件|1. where 数值+D/d = xx
1. where col1 = 数值+D/d
|
||结合in/not in/exists/not exist/between and/like/not like/,from/having/exsits/any/all/some/is null/is not null等子查询|支持数值+D/d |
||group by|数值+D/d 不支持会报错|
||order by|支持数值+D/d |
||distinct|支持数值+D/d |
||参与运算（  + - * /  > < >= <=  and or  ）|支持数值+D/d |
||connect by|支持数值+D/d |
|plsql|utf、匿名块、udt、udp、过程体中入参、声明、赋值、调用|支持数值+D/d |
||绑定参数（plsql的绑定参数走yasql不能走jdbc）|支持数值+D/d|
|jdbc|绑定参数|jdbc的绑定参数也就是PreparedStatement不支持加D这种用法|


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及|
|安全|不涉及|
|DFR/testkill|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


## Attachments:

[YDBRD-23481binary_double文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjg4OTcwYzJhZjRmNTIwNjhkIiwicmVmX2lkIjoiNjczOTZiYjg3MjgyMDZlZmI5MmYwOTZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTM0LCJleHAiOjE3ODIzODI5MzR9.6sbeCy4jeVWtFoMqL94gPfQvecrsuKF9CtUerdzAfe0)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[YDBRD-23481binary_double文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYjg4OTcwYzJhZjRmNTIwNjhlIiwicmVmX2lkIjoiNjczOTZiYjg3MjgyMDZlZmI5MmYwOTZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2NTM0LCJleHAiOjE3ODIzODI5MzR9.Iewn7p3hZ6VJIFxIoAfvULbYwxf-kEpxhMD49_2Ctyc)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
