Created by 胡晓畔 on 四月 01, 2024

# 1. 概述

在外置UDF支持C语言已有测试点的基础上，识别加固测试项，实现特性的质量加固

# 2. 需求分析

## 2.1 功能点分析

需要将C语言程序打包成动态链接库，创建对应的library对象后，再在创建外置udf时使用该library对象。调用外置udf时运行C语言函数，返回结果。

## 2.2 应用场景

|应用场景|大类|备注|
|---|---|---|
|外置UDF单独使用|需要外部进程调用外部C函数的场景|  
|
|外置UDF返回值结合表使用|insert into的值|  
|
||update，delete|  
|
||视图|  
|
|DQL查询应用|做绑定参数使用|  
|
||与普通函数嵌套使用|  
|
||嵌套普通UDF|  
|
|PLSQL|匿名块|  
|
||procedure|  
|
||UDP|  
|


## 2.3 规格约束

① 入参接口组，出参接口组，返回值接口组 共计45个接口组，yep接口通过yacli.h提供的用于出入参的yep接口组进行函数的出入参控制；

② extProc C通过YacHandle作为C函数的唯一入参；

③ C函数需要YacResult作为返回值；

如果用户C函数不满足上述要求，可能会导致编译错误，执行结果错误甚至发生异常导致yex_server程序core dumped（yex_server之后会由yasdb的守护线程重新拉起）。

④ library name 最大长度64

⑤ 用户需要按照外置udf的参数和返回值的顺序、方向、类型来使用yep接口处理C函数的出入参和返回值，当入参和yep函数不匹配时，数据库会进行隐式类型转换，不支持类型转换则报错；出参不允许修改类型

⑥   当入参为null时，对于数值型参数将获得0，对于字符型参数入参str将不会赋值，用户可以通过yepGetXxx函数的lenOrInd入参获得参数是否为null；空指针时报错

# 3. 详细测试设计【加固测试】

## 3.1 测试设计方法

  


**加固测试点：**

**1.数据类型测试**

|number类型|p ，s 边界值，覆盖p ,s 精度符合/不符合的场景|yepXXXNumber接口不会处理数据精度|
|---|---|---|
||覆盖 decimal 32,64,128 类型|  
|
||与Boolean类型的转换|  
|
|N类型|补充容错测试|  
|
|明确支持或者不支持，需要覆盖所有数据类型|float126类型 |  
|
||浮点特殊值|  
|
||gis类型 |不支持|
||json 类型|不支持|
||ROWID/UROWID|  
|
||XMLTYPE|不支持|


  


  


**2.外置UDF应用**

补充与普通函数的交互

|聚集函数|AVG count   listagg   stddev string_add var_pop wm_concat |优先级高|
|---|---|---|
|日期函数|ADD_MONTHS  age date  date_add last_day month_between now  time timediff timestamp  timestampdiff  utc_timestamp |  
|
|字符函数|ASCII  bit_length  char_length  chr cancat  find_in_set  instr left lengthb  lower   ltrim  position   REGEXP_COUNT  REGEXP_INSTR  REGEXP_LIKE  REGEXP_REPLACE  REGEXP_SUBSTR  REPLACE  RIGHT  split strpos  substr  substring  translate  trim  unistr  upper |  
|
|数学函数|abs  acos  asin  stan atan2 ceil  cos  cot  div  exp  floor  ln  log  mod  pi  random  round sign sin  sinh  sqrt  tan  tanh  trunc |  
|
|转换函数|bin  bin_to_num  hextoraw   NUMTODSINTERVAL  NUMTOYMINTERVAL  SCN_TO_TIMESTAMP  TIMESTMAP_TO_SCN   to_char  to_date  TO_DSINTERVAL to_number   to_timestamp to_yminterval  |  
|
|窗口函数|DENSE_RANK  FIRST_VALUE lag  last_value  lead  rank  row_number|优先级高|
|数组函数|array数组函数|  
|
|内置表函数|PX_CHANNEL  px_obj|  
|
|GIS函数|返回null的外置UDF作为GIS函数的入参；返回特定字符串的外置UDF做为入参|  
|
|其他函数|if   ifnull  isnull COALESCE DECODE EMPTY_BLOB EMPTY_CLOB LOCALTIME  NULLIF NVL TYPEOF   |  
|
||SYS_CONTEXT（namespace，parameter  ）    
  JSON 函数等 |  
|


  


  


**3.外置UDF在PLSQL中应用**

补充测试PLSQL中的应用，参照PLSQL测试设计checklist

|内置高级包    
    
|系统标准功能、事务处理相关,定时任务相关|  
|
|---|---|---|
|触发器|  
|  
|
|游标    
    
    
|外置UDF做游标参数,嵌套普通UDF做游标参数|优先级高|
|异常处理|抛出自定义异常|  
|
|标量类型|%type|  
|
|复合类型|%rowtype    
  OBJECT    
  TABLE(嵌套表)    
  数组类型|  
|
|绑定参数|参数default值是另一个外置UDF,支持数据类型转换,不支持数据类型转换|1已包含|
|嵌套|补充C和JAVA互相嵌套的测试场景 ，嵌套+DDL|优先级高|
||C函数修改表，执行UDF 调用C函数再次修改表，JAVA同理||
||UDF+ DBlink场景||
|外场UDF相关问题，替换为外置UDF验证|YDBRD-17953 【PLSQL】普通UDF作为过程体游标参数使用时数据库coredump|优先级高|
||YDBRD-17891 【外场】用自定义function查询空表，出现no data found报错||
||YDBRD-16399 【PLSQL】存储过程多层嵌套自定义高级包，调用时core在codStackMemCheck||
||YDBRD-15807 【外场】匿名块调用多层嵌套存储过程，core在raise ()||


  


  


**4.表，视图和查询应用**

补充外置UDF在table，view中的应用

|表    
    
    
|分区表|分区列：split分区,非分区列|  
|
|---|---|---|---|
||非分区表|default列,alter UDF的列|  
|
||宽表    
    
    
|索引列,非索引列|  
|
||普通表|索引列,非索引列|  
|
|视图|普通视图|  
|  
|
||force视图|  
|  
|
||只读视图|  
|  
|
||物化视图|  
|  
|
||补充系统视图|DBA_source    
  DBA_arguments    
  DBA_objects|  
|
|select查询应用|hash join|作为join条件    
  不做join列|  
|
||集合|集合算子混合    
  外置UDF和普通UDF    
  内置函数|  
|
||子查询|关联子查询    
  非关联子查询    
  标量子查询|  
|
|DML|insert|  
|  
|
||update|多表关联,非关联|  
|
||delete|  
|  
|
||结合嵌套场景|  
|  
|


  


  


**5.导入导出**

外置UDF导出，导入

外置UDF+N类型 导出，导入

导出，导入4096个外置UDF

  


**6.权限相关**

|权限    
    
|级联role授权|  
|
|---|---|---|
||切换schema|  
|
||切换用户–DBA用户，普通用户|  
|
|审计|外置UDF的create，drop，执行审计 |外置UDF已有create library ，drop library 审计，需要修改增加 execute审计|


  


  


**7.其他场景**

|max session |设置最大会话连接数，构造死循环+Ctrl C场景|测试是否释放掉卡住的连接，不影外置UDF的使用|可以手动释放|
|---|---|---|---|
|library替换|不通过replace直接替换|重启DB，使用新库|确认Oracle和yashan的表现一致|
||  
|不重启DB，先删除再移动新库，使用旧库|  
|
||  
|不重启DB，cp 直接替换|崖山yex_server core然后重启，会使用新库；,Oracle报错ORA-06521: PL/SQL: Error mapping function|


  


## 3.2 详细测试设计

详细测试设计，附XMind导图

--评审后替换为终稿

  


加固用例补充到CT KT 

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|√|
|KT|√|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


# 4. 测试用例

  [外置UDF支持C加固测试文本用例](https://conf.yasdb.com/pages/viewpage.action?pageId=141565049)  

# 5. 测试框架设计

  


# 6. 测试环境说明

  


  


# 7. 工作量评估

工作量：3  *人周*

计划测试完成时间：

## Attachments:

[外置udf支持C语言加固测试设计.pdf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmI4OTcwYzJhZjRmNTFmN2ZmIiwicmVmX2lkIjoiNjczOTY5NmI3MjgyMDZlZmI5MmVmMzI4IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3Mzc2LCJleHAiOjE3ODIyMTM3NzZ9.C5qLWlMe_aYkP8d7o5dXEGlitqGDnRTEX9D2BPlnTzw)

 (application/pdf)    
