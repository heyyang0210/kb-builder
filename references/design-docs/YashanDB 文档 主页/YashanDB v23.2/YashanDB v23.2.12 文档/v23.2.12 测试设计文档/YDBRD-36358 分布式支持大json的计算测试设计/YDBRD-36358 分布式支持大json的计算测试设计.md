# 1. 概述

## 1.1 相关文档

SR:   [https://pingcode.yasdb.com/pjm/items/6757efb5622069d46df6e08f?](https://pingcode.yasdb.com/pjm/items/6757efb5622069d46df6e08f?)  

#YDBRD-36358 分布式支持大json的计算

开发设计文档：  [YDBRD-36358：分布式支持大Json的计算设计文档 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67ecb5bc529b5c0231d0d4b7)  

个人调研文档：  [6.1.1【YDBRD-36358】Part1 个人调研 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/XIEZHAOXIAN/pages/677d01761e1551235befc4d2)  

调研文档：  [分布式支持大json的计算测试调研 | 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/FANYU/pages/67be7de02d2effe8fb1fd30f)  

概要设计文档：

## 1.2 特性说明

当前outline lob字段计算时，报错02021错误。要支持大json JSON_XXX的计算，包含：JSON，JSON_ARRAY_GET，JSON_ARRAY_LENGTH，JSON_EXISTS，JSON_QUERY，JSON_VALUE，JSON_SERIALIZE  


# 2. 需求分析

## 2.1 功能点分析

- 对功能/需求进行详细说明及分析，对应提供的功能点、函数、语法图、配置参数、视图、接口等；
- 开发设计的主要原理


|语法|作用|  
|
|:---|:---|---|
|JSON|用于将expr的值转换为二进制JSON数据|JSON(expr)|
|JSON_ARRAY_GET|从一个JSON数组数据中返回指定位置的元素|JSON_ARRAY_GET(json_value, index)|
|JSON_ARRAY_LENGTH|返回一个JSON数组数据的长度|JSON_ARRAY_LENGTH(json_value)|
|JSON_EXISTS|基于json_path所描述的路径对json_value进行查找，若对应查询结果不为空则返回TRUE，否则返回FALSE|JSON_EXISTS(json_value, json_path)|
|JSON_QUERY|将基于json_path所描述的路径对json_value进行检索，并将检索到的结果按照format_clause定义的显示选项进行封装并打印|JSON_QUERY(json_value, json_path, format)|
|JSON_VALUE|基于json_path所描述的路径对json_value进行检索，并返回对应的标量值|JSON_VALUE(expr, json_path)|
|JSON_SERIALIZE|将二进制json数据按照pretty格式或compact格式序列化为字符串，且序列化后的字符串长度不超过   `returning_clause`   定义的限制值|JSON_SERIALIZE(json_value returning_clause PRETTY EXTENDED)|


  


## 2.2 应用场景

- 需求本身的主要应用场景
- 需求与其他特性的关联场景


1）

2）

## 2.3 规格约束

- 需求定义的规格、约束，系统/模块上下文等
- 内部机制涉及的规格约束
- 部署形态


1）  分布式列存支持。

2）  不支持行外存储的Json转换为clob/blob/varchar/char()等类型。

3）  和行存一样，Json函数计算结果的长度不能超过32000，否则报错。



  


# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略

如：内置函数入参–边界值；等价类 ；语法图–路径覆盖

1）使用等价类划分、边界值覆盖

## 3.2 详细测试设计

### 3.2.1 DFX测试

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT并发|  
|  
|
|KT|  
|  
|
|长稳|  
|  
|
|一致性|  
|  
|
|三方测试工具  
(sqltest，sqlancer)|  
|  
|
|安全|  
|  
|
|DFR故障|  
|  
|
|HA高可用|  
|  
|
|压力|  
|  
|
|性能|  
|  
|
|可维护性|  
|  
|


### 3.2.2 等价类

|序|类别|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|1|功能校验,场景|建表|1、包含json格式的 行外lob,2、CREATE TABLE AS SELECT json列,3、分布表、复制表、分区表、组合分区|  
|  
|  
|
|||插入数据|1、lob列、json列,多列lob、多列json,2、INSERT INTO SELECT JSON(COL),3、INSERT INTO SELECT LOB,批量插入 /*+ BULKLOAD */,去重   /*+ DEDUPLICATE */,热数据、冷数据、   alter   system set _  enable_alter  _  slice   = true scope = memory type = all ;,异常场景|  [https://pingcode.yasdb.com/pjm/items/674d76ad622069d46df481a7?](https://pingcode.yasdb.com/pjm/items/674d76ad622069d46df481a7?)  ,#YDBRD-36060 【电子处方】外场：分布式insert into select outline lob场景core|||
|||更新数据|1、UPDATE SET COL2=JSON(COL1),2、UPDATE SET COL2=COL1 （json）||||
|||数据行数|1、  0、100、1000、10000||||
|2||数据大小      
|1、字符正常2000、20000  以及 32000 和超过32000的,2、lob类，正常+1G  
|  
|  
|  
|
|3|  
|大json的分片处理  
|生成1.5GB JSON文档，包含10^6个嵌套对象，使用json_query检查分片是否完成  
|  
|  
|  
|
|||**跨节点计算的场景   **   |不同分布键、  **数据分布到了不同的节点**,**调用函数的时候：是跨节点的**||||
|||匿名块|在匿名块里使用：绑定参数||||
|||dblink|||||
|||并行度|开启并行度,||||
|||jdbc驱动|驱动返回几个大json列(经过计算的) ,1、可重复读,2、不会重复释放,3、通过 temp_lob   release 接口 能够释放,4、断连后能全部释放,,,计算结果返回客户端（客户端不作缓存）,,temp_lob  (需要手动close) /   json  （自己保证close、重复取）,||||
||||||||
|4|相关函数校验|JSON|json数据类型,1、两种结构形式和六种数据类型以及使用  [JSON扩展格式](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/json.html#json-ext)  ,结构类型：  **键值对形式、数组形式、多结构嵌套混合**,六种数据类型：,- 对象（Object）
- 数组（Array）
- 字符串（String）
- 数字（Number）
- 布尔值（True/False）
- 空值（Null）
,JSON扩展格式：（在JSON扩展格式里，json数据里的Value还可以为如下类型：）,- Tinyint
- Smallint
- Integer
- Bigint
- Float
- Double
- Number
- Binary
- Timestamp
- Date
- Time
|  [json | YashanDB Doc](https://cod-doc.yasdb.com/yashandb/23.4/zh/Development-Guide/SQL-Reference-Manual/General-SQL-Syntax/json.html)  |||
|5||JSON_FORMAT|1、JSON(expr)，expr为expr、blob、xmltype、nclob、nvarchar、varchar  
2、JSON_FORMAT(JSON(expr))|  
|  
|  
|
|6||JSON_ARRAY_GET|JSON_FORMAT(JSON_ARRAY_GET(JSON(c2), -1))  
|  
|  
|  
|
||  
|JSON_ARRAY_LENGTH|1、JSON_ARRAY_LENGTH(JSON(c2)),2、嵌套数组长度计算  
|  
|  
|  
|
|||JSON_EXISTS|1、JSON_EXISTS(JSON(c2), '$.keyC'),2、不正确的json，验证容错性||||
|||JSON_QUERY|1、JSON_QUERY(JSON(c2), '$'),2、多维度数组访问,3、数据超出规格、不超出规格,补充：,  [https://pingcode.yasdb.com/wiki/pages/673960e1728206efb92ec558](https://pingcode.yasdb.com/wiki/pages/673960e1728206efb92ec558)  ||||
|||JSON_VALUE|1、JSON_VALUE(JSON(c2), '$.keyC'),2、REPLACE(JSON_QUERY(JSON(T4.RX_INFO),'$."rx_drug_cnt"'),'"',''),3、路径覆盖$.a.b[0], $[*].id, $..price,4、单层路径、深层路径,5、数组元素提取、通配符路径查询,6、类型转换,7、空值,||||
|||JSON_SERIALIZE|JSON_SERIALIZE(JSON(c2))||||
|||组合函数    |是否遵循链式调用||||
||||||||
|7|文档校验      
|检查文档是否删除|json函数中含有的：,expr不能为超过32000字节的VARCHAR、  **LOB类型数据**|  
|  
|  
|
|8|性能|  
|1、一主一备跟单机持平,2、分布式lob性能规格      
|  
|  
|  
|
|9|可靠性||计算查询过程中，节点异常  
,计算查询  -  挂一个节点  - 恢复  - 再查|  
|  
|  
|
||计算配置参数||**COLUMNAR_VM_BUFFER_SIZE**||||
||||看一下执行计划是否走到列计算||||


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


## 4.1 冒烟用例

```
1.
```

  


## 4.2 文本用例

文本用例：



属性表：

# 5. 测试框架设计

- 如果用例不能实现自动化需要在此标注并说明原因
- 确认使用的测试框架及其满足度


1） 自动化用例：

Guider框架执行用例，生成预期，使用yasql模式执行。

使用导入导出框架进行测试  [https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test)  

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

1）辅助工具：

Guider部署、执行、字符集配置脚本：  [https://git.yasdb.com/xiezhaoxian/scripts](https://git.yasdb.com/xiezhaoxian/scripts)  

2）测试环境：

|  
|CPU|操作系统|可用内存|可用磁盘空间|磁盘类型|
|:---|:---|:---|:---|:---|:---|
|192.168.7.105|Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz|Linux AchorBase 3.10.0-1160.114.2.el7.x86_64|50G|303G|HDD|


# 7. 工作量评估

工作量：天

计划测试完成时间：  
