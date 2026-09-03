Created by 贺天欢, last modified on 一月 15, 2024

  [YDBRD-22630](https://jira.yasdb.com/browse/YDBRD-22630?src=confmacro)    **-**  **USE_NATIVE_TYPE的数据类型功能**  **完成**

**开发设计文档：**    [特性设计-YDBRD-15833:增加原生数据类型映射配置参数USE_NATIVE_TYPE](/pages/createpage.action?spaceKey=YAS&title=%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1-YDBRD-15833%3A%E5%A2%9E%E5%8A%A0%E5%8E%9F%E7%94%9F%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B%E6%98%A0%E5%B0%84%E9%85%8D%E7%BD%AE%E5%8F%82%E6%95%B0USE_NATIVE_TYPE)  

# 1.   **概述**

YASHAN的INT/TINYINT/SMALLINT/BIGINT/FLOAT/DOUBLE与ORACLE均存在差异；    
  为了提升ORACLE兼容性，需要提供一个建库级的配置参数USE_NATIVE_TYPE，默认为TRUE使用的是原生类型，设置为FALSE则将上述类型映射成为oracle对应的NUMBER数据类型，P/S精度也跟ORACLE对齐；

# 2.   **需求分析**

**需求范围：**  **单机，行表、列表（不支持float）**

**分为2部分：**

1. **新增建库级的配置参数USE_NATIVE_TYPE，并在USE_NATIVE_TYPE为FALSE时存在数据类型映射功能（INT/TINYINT/SMALLINT/BIGINT/FLOAT）**
1. **USE_NATIVE_TYPE为FALSE时，驱动、OCI、EXP/IMP，YASQL，YASLDR，协议等相关场景下对数据类型映射的配合**


数据映射规则：

1. USE_NATIVE_TYPE=true，不变
1. USE_NATIVE_TYPE=false，如下


|映射规则|原生|目标存储类型|目标显示（desc查看）|目标运算|
|:---|:---|---|:---|---|
|float(p)    
  ->   DTYPE_NUMERIC_FLOAT(p)|float(p),p：0 <= p <= 53,字节长度：4，值域：,[-3.402823E38, -1.401298E-45]    
  0    
  [3.402823E38, 1.401298E-45]    
  数字3.402823和1.401298为四舍五入的值，非最精确值|NUMBER(log10(2^p)),p：1<= p <= 126,字节长度：22，值域：正负[1.0x10^-130,1.0x10^126]|float(P)，默认为float(126)|  
,NUMBER(log10(2^p))|
|TINYINT    
  ->  oracle对应的NUMBER(38,0),  
|TINYINT,字节长度：1，值域：  [-2  7  , 2  7   - 1]    
  2  7  =  128|NUMBER(38,0),字节长度：22，值域：正负99999999999999999999999999999999999999    
|NUMBER(38)|NUMBER(38,0)|
|SMALLINT    
  ->  oracle对应的NUMBER(38,0)|SMALLINT,字节长度：2，值域：  [-2  15  , 2  15   - 1],2  15  =  32,768|NUMBER(38,0),字节长度：22，值域：正负99999999999999999999999999999999999999|NUMBER(38)|NUMBER(38,0)|
|INT    
  ->  oracle对应的NUMBER(38,0),  
|INT,字节长度：4，值域：  [-2  31  , 2  31   - 1],2  31  =  2,147,483,648|NUMBER(38,0),字节长度：22，值域：正负99999999999999999999999999999999999999|NUMBER(38)|NUMBER(38,0)|
|BIGINT    
  ->  oracle对应的NUMBER(38,0)|BIGINT,字节长度：8，值域：  [-2  63  , 2  63   - 1]    
, 2  63  =  9223372036854775808|NUMBER(38,0),字节长度：值域：正负99999999999999999999999999999999999999|NUMBER(38)|NUMBER(38,0)|


**备注：**

a.建库以后shutdown，再手动修改  文件，配置  USE_NATIVE_TYPE为相反值或其他值  ，重启会报错；配置为相同的值，重启正常。

b.  建库以后，执行语句alter system set   USE_NATIVE_TYPE   = true\false; 会报错 

show  parameter use_native_type;--查看参数值

c.  USE_NATIVE_TYPE   = false时，binary_float也是存在的，desc查看时是float，没有精度p，

字节长度：4，值域：

[-3.402823E38, -1.401298E-45]    
  0    
  [3.402823E38, 1.401298E-45]    
  数字3.402823和1.401298为四舍五入的值，非最精确值

d.float(p)--》number的P转换，如下示例

log(2^1）=0.301029995664 →1

log(2^2）=0.602059991328 →1

log(2^23）=6.923689900272 →7

log(2^24）=7.224719895936 →8

log(2^47）=14.148409796207 →15

log(2^81）=24.383429648782 →25

log(2^100）=30.102999566398 →31

log(2^126）=37.929779453662   →38

  


示例：（  log(2^5）=1.50514997832 →2，有效位数是2  ）

CREATE TABLE test (col1 NUMBER(5,2), col2 FLOAT(5));

INSERT INTO test VALUES (1.23, 1.23);    
  INSERT INTO test VALUES (7.89, 7.89);    
  INSERT INTO test VALUES (12.79, 12.79);    
  INSERT INTO test VALUES (123.45, 123.45);

SELECT * FROM test;

COL1 COL2    
  ---------- ----------    
  1.23 1.2    
  7.89 7.9    
  12.79 13    
  123.45 120

# 3.   **测试设计方法**

本文主要测试  USE_NATIVE_TYPE参数配置有效性，  INT/TINYINT/SMALLINT/BIGINT/FLOAT数据类型的存储和取值运算的正确性，其他相关配套工具（导入导出，OCI、驱动相关责任人复制）的测试，用例设计方法主要涉及边界值、等价类、正交实验法及错误推测法组合进行设计。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

|测试对象|输入条件1|输入条件2|有效等价类|备注|无效等价类|备注|
|:---|:---|:---|:---|:---|:---|:---|
|参数配置|建库前|参数名|大小写|建库成功|USE_NATIVE/TYPE/USE_TYPE/NATIVE_TYPE|建库失败|
||||大小写混写|  
|包含其他非法字符等|  
|
|||参数取值|true/TRUE|建库成功|1/0其他等|建库失败|
||||false/FALSE|  
|/|  
|
||建库后|SQL语句更改参数值|alter system set USE_NATIVE_TYPE = true\false;|报错，更改失败|/|  
|
|||shutdown，更改ini文件|配置USE_NATIVE_TYPE配置为相同的值|重启正常|配置USE_NATIVE_TYPE为相反值|重启失败，报错正确|
||||/|/|配置USE_NATIVE_TYPE为其他值|重启失败，报错正确|
|部署验证（USE_NATIVE_TYPE=FALSE）|单机普通表|行表|INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列支持|  
|  
|  
|
|||列表|INT/TINYINT/SMALLINT/BIGINT/binary_float列支持|  
|FLOAT列不支持|  
|
||单机分区表|range分区|INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列作为分区键|正确分到对应分区|  
|  
|
|||list分区|INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列作为分区键|正确分到对应分区|  
|  
|
|||hash分区|INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列作为分区键|正确分到对应分区|  
|  
|
||单机临时表|  
|INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列支持|  
|  
|  
|
||分布式|  
|  
|不支持|  
|  
|
|基本功能（USE_NATIVE_TYPE=FALSE）    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|DDL    
    
    
|建表|直接建表覆盖INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列；,desc查看（）|FLOAT覆盖带精度（0、1、23、24、126、127）,FLOAT覆盖不带精度（默认126）|  
|  
|
|||  
|create table .. as select from XX table建表覆盖INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列；,desc查看（）|FLOAT覆盖带精度（0、1、23、24、126、127）,FLOAT覆盖不带精度（默认126）|  
|  
|
|||alter表列|作为列的默认值覆盖INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列；|覆盖类型的边界值|  
|  
|
|||建视图|create view .. as select from XX table建视图覆盖INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列；,desc查看（）|FLOAT覆盖带精度（0、1、23、24、126、127）,FLOAT覆盖不带精度（默认126）|  
|  
|
||DML    
    
    
    
    
    
    
|insert INT/TINYINT/SMALLINT/BIGINT列|覆盖数值类型原生和映射后的范围边界值：,-128~127,-2^15 (-32,768) ~2^15 - 1 (32,767),-2^31 (-2,147,483,648) ~2^31 - 1 (2,147,483,647),-2^63 (-9223372036854775808)~2^63-1 (9223372036854775807),正负99999999999999999999999999999999999999（38个9）|  
|  
|  
|
||||检查字节长度|  
|  
|  
|
|||insert FLOAT列|覆盖数值类型原生和映射后的边界值、特殊值：,[-3.402823E38, -1.401298E-45],0,[3.402823E38, 1.401298E-45],正负[1.0x10^-130,1.0x10^126)|FLOAT的P覆盖同上DDL时,正数超过原生值域最大值（不会变成inf）；,负数超过原生值域最大值（不会变成-inf）,正数超过原生值域最小值（不会变成0）,负数超过原生值域最小值（不会变成0）|  
|  
|
||||检查字节长度|  
|  
|  
|
|||insert binary_FLOAT列|覆盖数值范围边界值：,[-3.402823E38, -1.401298E-45],0,[3.402823E38, 1.401298E-45]|正数超过原生值域最大值（会变成inf）；,负数超过原生值域最大值（会变成-inf）,正数超过原生值域最小值（会变成0）,负数超过原生值域最小值（会变成0）|  
|  
|
||||检查字节长度|  
|  
|  
|
|||隐式转换|数值带双引号--》INT/TINYINT/SMALLINT/BIGINT/FLOAT列|覆盖同上|  
|  
|
|||select |INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列|覆盖同上|  
|  
|
|||update|INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列|覆盖同上|  
|  
|
||入参函数    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|转换函数    
    
    
    
|cast：others to INT/TINYINT/SMALLINT/BIGINT|  
|  
|  
|
||||cast：others to FLOAT列|  
|  
|  
|
||||cast：others to binary_float列|  
|  
|  
|
||||to_number|  
|  
|  
|
||||to_char|  
|  
|  
|
|||数学函数    
    
    
    
    
|abs：INT/TINYINT/SMALLINT/BIGINT列|返回：number(38)|  
|  
|
||||abs：FLOAT列|返回：number|  
|  
|
||||abs：binary_FLOAT列|返回：float|  
|  
|
||||round：INT/TINYINT/SMALLINT/BIGINT列|返回：number|  
|  
|
||||round：FLOAT列|返回：number|  
|  
|
||||round：binary_FLOAT列|未指定round_number时输出FLOAT，否则输出NUMBER|  
|  
|
|||聚合函数    
    
    
    
    
    
    
    
    
|max/min：INT/TINYINT/SMALLINT/BIGINT列|返回：number(38)|  
|  
|
||||max/min：FLOAT列|返回：number|  
|  
|
||||max/min：binary_FLOAT列|返回：float|  
|  
|
||||sum：INT/TINYINT/SMALLINT/BIGINT列|返回：number|  
|  
|
||||sum：FLOAT列|返回：number|  
|  
|
||||sum：binary_FLOAT列|返回：float|  
|  
|
||||avg：INT/TINYINT/SMALLINT/BIGINT列|返回：number|  
|  
|
||||avg：FLOAT列|返回：number|  
|  
|
||||avg：binary_FLOAT列|返回：float|  
|  
|
||||count：INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列|返回：number|  
|  
|
|||字符函数|lengthb/length：INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列|返回：number|  
|  
|
||||instr：INT/TINYINT/SMALLINT/BIGINT/FLOAT/binary_float列|返回：number|  
|  
|
||DQL    
    
    
    
    
    
    
    
|filter    
    
    
    
    
|四则运算：*、/、mod、%、+、-|覆盖INT/TINYINT/SMALLINT/BIGINT/FLOAT列；,覆盖不同类型间、不同精度间的，比如float(p)和number(p,s),float(p)和number,float(p)和binary_float,  
,  
    
    
|  
|  
|
||||>=，<=，>，<,=,!=||  
|  
|
||||in/not in||  
|  
|
||||exists/not exists||  
|  
|
||||between and||  
|  
|
||||like/not like||  
|  
|
|||order by|  
||  
|  
|
|||group by|  
||  
|  
|
|||join on|  
||  
|  
|
|其他场景（USE_NATIVE_TYPE=FALSE）    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
    
|查询视图    
    
    
|USE_NATIVE_TYPE=TRUE|/|跑上车不影响存量用例即可|  
|  
|
|||USE_NATIVE_TYPE=FALSE    
    
|ALL_TAB_COLS、ALL_ARGUMENTS、ALL_COLL_TYPES、ALL_TYPE_ATTRS|  
|  
|  
|
||||DBA_TAB_COLS、DBA_ARGUMENTS、DBA_COLL_TYPES、DBA_TYPE_ATTRS|  
|  
|  
|
||||USER_TAB_COLS、USER_ARGUMENTS、USER_COLL_TYPES、USER_TYPE_ATTRS|  
|  
|  
|
||查询系统表|USE_NATIVE_TYPE=TRUE|/|跑上车不影响存量用例即可|  
|  
|
|||USE_NATIVE_TYPE=FALSE|CLUSTER_INFO$、GROUP_INFO$、NODE_INFO$|系统表都是int，bigint，smallint，tinyint前面加上binary_前缀，系统表里原来就没有float的列|  
|  
|
||||LOB$、RECYCLEBIN$||  
|  
|
||||SYS.WRH$_SQLSTAT、SYS.WRH$_SQLTEXT||  
|  
|
||PLSQL|udt|1、UDT类型声明INT/TINYINT/SMALLINT/BIGINT/FLOAT类型，创建udt_varray_type、object_type|  
|  
|  
|
||||2、基于步骤1创建子ust类型，也声明INT/TINYINT/SMALLINT/BIGINT/FLOAT类型|  
|  
|  
|
|||udp|1、INT/TINYINT/SMALLINT/BIGINT/FLOAT类型的变量声明|  
|  
|  
|
||||2、对申明的变量赋值\运算|  
|  
|  
|
|||udf|1、INT/TINYINT/SMALLINT/BIGINT/FLOAT类型的变量声明|  
|  
|  
|
||||2、对申明的变量赋值\运算|  
|  
|  
|
||||3、INT/TINYINT/SMALLINT/BIGINT/FLOAT类型作为udf的返回值|  
|  
|  
|
|||匿名块|1、INT/TINYINT/SMALLINT/BIGINT/FLOAT类型的变量声明|  
|  
|  
|
||||2、对申明的变量赋值\运算|  
|  
|  
|
||||3、覆盖形参即绑定参数|  
|  
|  
|
|||过程体|1、INT/TINYINT/SMALLINT/BIGINT/FLOAT类型的变量声明|  
|  
|  
|
||||2、对申明的变量赋值\运算|  
|  
|  
|
||||3、覆盖形参即绑定参数|  
|  
|  
|
|||trigger|1、建表包含INT/TINYINT/SMALLINT/BIGINT/FLOAT类型，在列上创建trigger|  
|  
|  
|
||||2、做相应操作触发trigger|  
|  
|  
|
||||3、创建自治触发器|  
|  
|  
|
|||变量窥视|INT/TINYINT/SMALLINT/BIGINT/FLOAT类型覆盖显示游标的出入参|强制类型校验RECORD/CURSOR|  
|  
|
|||高级包|dbms_metedata_get_ddl：建表（带INT/TINYINT/SMALLINT/BIGINT/FLOAT列），查看返回值|复制返回值语句还原正确；float覆盖ddl部分的精度,  
|  
|  
|
|升级场景    
    
    
|  
|  
|未包含use_native_type参数的低版本包——》本次含use_native_type的新包|升级成功，升级前show parameter use_native_type为空，升级后查看为USE_NATIVE_TYPE和true，且数据类型和原生一致未变|  
|  
|
||  
|  
|包含use_native_type参数的低版本包——》含use_native_type的高版本包：,升级前.ini文件内false|升级前flase的升级后show查看 parameter use_native_type=flase|  
|  
|
||  
|  
|包含use_native_type参数的低版本包——》含use_native_type的高版本包：,升级前.ini文件内true|升级后show parameter use_native_type=true，且数据类型和原生一致未变|  
|  
|
||  
|  
|包含use_native_type参数的低版本包——》含use_native_type的高版本包：,升级前yasdb.ini文件内不存在USE_NATIVE_TYPE参数|升级后show parameter use_native_type=true，且视图内和原生一致未变 |  
|  
|


  [YDBRD-22631 use_native_type测试设计（OCI驱动和c驱动部分）](https://conf.yasdb.com/pages/viewpage.action?pageId=135600702)  

  [YDBRD-22631 USE_NATIVE_TYPE JDBC驱动适配](https://conf.yasdb.com/pages/viewpage.action?pageId=135601735)  

  [YDBRD-22631 USE_NATIVE_TYPE yasldr 测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135602696)  

  [use_native_type odbc驱动测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135604860)  

  [YDBRD-22631 USE_NATIVE_TYPE exp/imp详细测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=135602040)  

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|不涉及|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|涉及|
|安全|不涉及|
|DFR/testkill|不涉及|
|HA|不涉及|
|压力|不涉及|
|性能|不涉及|
|可维护性|不涉及|


  


  


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

PS.用例属性表

# 6.   **测试框架设计**

1. 如果用例不能实现自动化需要在此标注并说明原因
1. 如果需要使用新的测试框架实现用例的自动化，需要在此说明测试框架的架构逻辑及详细设计
1. 如果沿用已有测试框架，需要在此标注测试框架的路径


# 7.   **测试环境说明**

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

  


## Attachments:

[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGFhMWFkOWEzMzExZGM4M2MwIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.ro5efNqxjEJfg1FCJyiwLBa3fs-ftMmnS29_BnmYzyg)

 (application/x-xmind)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGFhMWFkOWEzMzExZGM4M2MxIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.04rb70DmcRHpjDlL-glvc-mK2tS8s-MuvK1WUBW3LQw)

 (application/x-xmind)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGE4OTcwYzJhZjRmNTIwNTQ5IiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.kZ5n8NKUA24jScVtOz7jAMlxDcN50KflhKKQiw8KP50)

 (application/x-xmind)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGE4OTcwYzJhZjRmNTIwNTRhIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.X_L5LSsskyJN898_NOiAfOhaK_AoNeYkt7MMJqRANRc)

 (application/x-xmind)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGFhMWFkOWEzMzExZGM4M2MyIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.WIWCOd5R5LRUPkpSIRhgQLKwJ26HUA3SjkuRqet5cao)

 (application/x-xmind)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGE4OTcwYzJhZjRmNTIwNTRiIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.LJrF0DgIfXjyAEN4rpzOhc8mGqOF5LyWI94Nxc2vOI8)

 (application/x-xmind)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGFhMWFkOWEzMzExZGM4M2MzIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.s8Se5WN0wwcwfXqbWdUnqnfAr0gNeWmEs2_LPhPZcEQ)

 (application/x-xmind)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGE4OTcwYzJhZjRmNTIwNTRjIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.rCD2H-6RpdO6eSQMNSJ5oNm7gslFg00Rka2w5St1aPA)

 (application/x-xmind)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGFhMWFkOWEzMzExZGM4M2M0IiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.HlTGs7ub25sESSgKo_qs1PLqbX4l23rYilStp4azoq8)

 (application/x-xmind)    


[USE_NATIVE_TYPE文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGE4OTcwYzJhZjRmNTIwNTRlIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.ou46GXb8MYvVspHFNZ6sUSeFZHhrAXnkNBP6v5RRWnY)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[native_type用例属性表new.csv](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGFhMWFkOWEzMzExZGM4M2M1IiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.ctgWzA27q_tRHIn80EouNRe8vOnrSnLye_ya23wPT7Q)

 (text/csv)    


[USE_NATIVE_TYPE测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiOGE4OTcwYzJhZjRmNTIwNTUwIiwicmVmX2lkIjoiNjczOTZiOGE1OTNmOTljOWZmMjM2M2Q2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk1MzM1LCJleHAiOjE3ODIzODE3MzV9.RqgzD044S1oZUhfN-PVGjcd5MKAV13QLkb54IYTdXK0)

 (application/x-xmind)    


## Comments:

|  [](null)  ,  [*数据类型测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=76928403)  ,Posted by hetianhuan at 十一月 11, 2023 18:52|
|---|
|  [](null)  ,遗留问题：  use_native_type和sql_plugin不兼容最好sql_plugin的时候就报错，而不是等到后面数据类型才报不支持，而且这种错误信息也有问题，unsupported datatype 40， 这个用户完全看不懂   --王海峰：客户系统上不可能同时出现mysql、oracle两个数据库，暂不处理,Posted by hetianhuan at 一月 11, 2024 15:06|
|  [](null)  ,![](https://pingcode.yasdb.com/atlas/files/public/67396b8a8970c2af4f520552/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTUzMzUsImV4cCI6MTc4MjMwNjEzNX0.Plo5iu6uXOOEC4quF6PIffQYtDfluCfX2nWVRUIEa2c),详见：YDBRD-25896,Posted by hetianhuan at 一月 12, 2024 14:20|
