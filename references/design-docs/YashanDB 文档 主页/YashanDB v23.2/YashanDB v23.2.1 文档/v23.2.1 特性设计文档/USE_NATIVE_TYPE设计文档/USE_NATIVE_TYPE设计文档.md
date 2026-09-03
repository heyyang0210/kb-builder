Created by 徐伟, last modified on 十一月 16, 2023

IR：    [YDBRD-22557](https://jira.yasdb.com/browse/YDBRD-22557?src=confmacro)    -  增加原生数据类型映射配置参数USE_NATIVE_TYPE  验收中    [YDBRD-15833](https://jira.yasdb.com/browse/YDBRD-15833?src=confmacro)    -  增加原生数据类型映射配置参数USE_NATIVE_TYPE  完成

SR：    [YDBRD-22630](https://jira.yasdb.com/browse/YDBRD-22630?src=confmacro)    -  USE_NATIVE_TYPE的数据类型功能  完成    [YDBRD-22629](https://jira.yasdb.com/browse/YDBRD-22629?src=confmacro)    -  USE_NATIVE_TYPE的数据类型功能  完成

##   [1. Overview（概述）](#1-overview概述)  

增加USE_NATIVE_TYPE配置参数以兼容oracle数据类型，默认为TRUE使用的是原生类型，设置为FALSE则将INT/TINYINT/SMALLINT/BIGINT/类型映射成为oracle对应的NUMBER数据类型，FLOAT类型映射成oracle的FLOAT，P/S精度也跟ORACLE对齐。

##   [2. Features（功能特性）](#2-features功能特性)  

1. 增加配置参数USE_NATIVE_TYPE，必须为系统级参数命令设置，在control文件生成，不能设置更改。配置参数是布尔类型，默认值为TRUE，只能在建库之前通过yasdb.ini文件设置。TRUE表示使用原生数据类型，FALSE表示使用Oracle兼容类型
1. 增加数据类型DTYPE_NUMERIC_FLOAT，在USE_NATIVE_TYPE为FALSE时，将float数据类型的type设置为numeric_float
1. INT/TINYINT/SMALLINT/BIGINT在USE_NATIVE_TYPE为FALSE时映射成number类型，其中P=38，S=0，小数需四舍五入。float(p)类型为DTYPE_NUMERIC_FLOAT，显示的时候仍然按照定义内容显示，但是实际存储为number，scale = ANS_INVALID_SCALE， precision 为定义的值，但是在转成number运算的时候需要将precesion设置为ceil(log10(2^p))(函数内使用全局数组映射)；当不设置p时，默认为float(126)
1. float(p)的p转成十进制进行四舍五入，但是最终实现能插入值的范围都是126个bit位，38位字节精度


```
使用cast时，返回类型为DTYPE_NUMERIC_FLOAT
SQL&gt; create or replace view v100 as select cast('1555555' as float(7) ) a from dual;

视图已创建。

SQL&gt; desc v100;
 名称                                    是否为空? 类型
 ----------------------------------------- -------- ----------------------------
 A                                                  FLOAT(7)


SQL&gt; select cast('1555555' as float(7) ) from dual;

     CAST('1555555'ASFLOAT(7))
------------------------------
                       1560000



```

**支持返回值float(p)类型的函数**

|函数|语句|返回值|
|---|---|---|
|cast|cast(77 as float(1))|float(1)|


##   [3. Interfaces（接口）](#3-interfaces接口)  

1.增加配置接口：

```
static CodResult cbpmUseNativeType(CodParamItem* item, CodText* value, CodParamScope scope)


```

2.float转成number存储：

```
static CodResult tryParseFloatPrecision(AnlParser* parser, LangWord* word, TypeDesc* desc);
static inline CodVoid codFloatP2NumberP(CodUint8 floatP, CodUint8* numberP);
CodResult codNumericFloatRound(CodNumber* number, CodUint8 floatPrecision);
CodResult codNumericFloatFloor(CodNumber* number);


以及其他各种数据类型转换函数，详情见：https://conf.yasdb.com/pages/viewpage.action?pageId=100093011

```

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1.use_native_type配置参数只在建库时生效，不能通过alter命令修改，且只能在yasdb.ini文件中修改

2.float(p), p为二进制位数，取值范围是1到126，默认为126。实际输出结果根据p算出对应的十进制位数进行四舍五入

3.列存暂不支持numeric_float类型，暂不支持创建列式索引

4.real类型暂不处理

5.if/ifNull mysql兼容函数，在参数类型为numeric_float，返回值类型为number; decode/greatest/least/coalesce/nullif/nvl/nvl2函数返回值类型不会为numeric_float，会改写成number

6.依据常量数值大小设置的数据类型，当前暂不处理

7.如下函数返回值类型为bigint暂不处理：

内置函数：COUNT,position,timestamp_to_scn,timestampdiff,jsonArrayLength,bitlength,characterLength,charLength,instr,LENGTH,lengthb,regExpCount,regExpInstr,bitlength窗口函数：biwCount,biwRowNumber,biwDenseRank,biwRank高级包：getLobLength

##   [5. Detail Design（详细设计)](#5-detail-design详细设计)  

增加配置参数见参考文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=130151726](https://conf.yasdb.com/pages/viewpage.action?pageId=130151726)  

增加数据类型见参考文档：    [https://conf.yasdb.com/pages/viewpage.action?pageId=100093011](https://conf.yasdb.com/pages/viewpage.action?pageId=100093011)  

**设置USE_NATIVE_TYPE配置参数方法**

USE_NATIVE_TYPE配置参数是建库级参数，默认值为TRUE，只能在建库时通过yasdb.ini文件设置，且设置后不允许更改。从旧版本升级时，若旧版本已经设置了USE_NATIVE_TYPE为FALSE，则升级后继续保持FALSE；其他情况USE_NATIVE_TYPE均保持为TRUE

详细设置方法如下：

1. 在建库之前，在yasdb.ini文件中设置USE_NATIVE_TYPE参数（如果之前已经建库，则需要先删除旧的数据库，切记要备份文件）
1. 保存yasdb.ini文件，使用nomount模式启动yasdb，使用create database语句创建数据库
1. 建库成功后，可以通过    `show parameter use_native_type;`    语句查询参数是否设置成功


```
-- 例如
USE_NATIVE_TYPE=TRUE
-- 或者
USE_NATIVE_TYPE=FALSE

```

**USE_NATIVE_TYPE为FALSE场景**

1. parse阶段，对于INT/TINYINT/SMALLINT/BIGINT，column->typeDesc设置为number类型，precesion设置为38，scale为0；而float类型的column->typeDesc设置为DTYPE_NUMERIC_FLOAT类型，scale = ANS_INVALID_SCALE， precision 为定义的值，但是在转成number运算的时候需要将precesion设置为ceil(log10(2^p))(函数内使用全局数组映射)；默认为其他类型保持不变。
1. 除了insert对DTYPE_NUMERIC_FLOAT需要进行precesion转换(rowAddNumber)，cast函数做applyDesc，pbConvert，rowAddNumericFloat等原先使用codNumberRound地方，将二进制p转成十进制p，其余都与DTYPE_NUMBER保持一致
1. varConvert时，DTYPE_NUMERIC_FLOAT运算与number一致，但是dstType类型仍为DTYPE_NUMERIC_FLOAT；对于cast函数，还会执行applyNumFloatDesc，根据p进行四舍五入。
1. desc显示：使用parse阶段设置的p显示


  


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

  


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1、cast函数、round函数、left、right、instr、min/max(窗口)、decode

2、varEqual、varCompare、matCompareNumber、matCompareFixedRow、varMod等使用codNumberCompare，使用number->exp比较

3、四则运算用到number->exp

4、desc显示、getDDL

5、AC：optmzExprAddCast，convExprNodeDataType，makeMulNode

##   [6.1 自检策略](#61-自检策略)  

1. 先根据ANS_MAX_PRECISION检查是否所有numberic_float该赋值正确的precision
1. 检查所有使用codNumberRound、codNumberFloor
1. 根据类型添加文档再检查是否有遗漏处
1. 有部分函数使用数据类型范围来判断是否合法，如：verifyIntervalPartCol、verifyPartKeyColumn


  


##   [7. Workload（工作量）](#7-workload工作量)  

待刷新

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

1、驱动，导入导出，元数据导入导出需适配

2、风险点：

- 较多函数都使用exprNode的desc Type，对于numeric_float需要特殊处理
- varConvert的dstType为num_float时，当前没更改；


3、23.2版本需关注绑定参数，conclude类型推导是否使用原类型（如min/max，biwMin/biwMax/biwMedian等）

  


  


  


  


## Attachments:

[image2023-6-2_15-22-12.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjMmRhMWFkOWEzMzExZGM4ODM2IiwicmVmX2lkIjoiNjczOTZjMmQ1OTNmOTljOWZmMjM2YjRkIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk5NTI4LCJleHAiOjE3ODIzODU5Mjh9.MVqMBYSoccsBBBbUSnjxMAFyMYJAEwWb-QeM91P4Wn4)

 (image/png)    
