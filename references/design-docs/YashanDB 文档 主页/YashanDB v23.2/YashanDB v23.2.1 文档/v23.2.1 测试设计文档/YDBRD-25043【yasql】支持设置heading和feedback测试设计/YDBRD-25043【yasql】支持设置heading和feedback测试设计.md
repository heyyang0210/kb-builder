Created by 谢昭贤 on 十月 13, 2024

# YDBRD-25043 - 【yasql】支持设置参数控制heading和feedback测试设计

  


-   [YDBRD-25043 - 【yasql】支持设置参数控制heading和feedback测试设计](#YDBRD25043【yasql】支持设置heading和feedback测试设计-YDBRD-25043-【yasql】支持设置参数控制heading和feedback测试设计)  
-   [](#YDBRD25043【yasql】支持设置heading和feedback测试设计-)  
-   [1. 概述](#YDBRD25043【yasql】支持设置heading和feedback测试设计-1.概述)  
    -   [1.1 相关文档](#YDBRD25043【yasql】支持设置heading和feedback测试设计-1.1相关文档)  
    -   [1.2 特性说明](#YDBRD25043【yasql】支持设置heading和feedback测试设计-1.2特性说明)  
-   [2. 需求分析](#YDBRD25043【yasql】支持设置heading和feedback测试设计-2.需求分析)  
    -   [2.1 功能点分析](#YDBRD25043【yasql】支持设置heading和feedback测试设计-2.1功能点分析)  
    -   [2.2 应用场景](#YDBRD25043【yasql】支持设置heading和feedback测试设计-2.2应用场景)  
    -   [2.3 规格约束](#YDBRD25043【yasql】支持设置heading和feedback测试设计-2.3规格约束)  
-   [3. 详细测试设计](#YDBRD25043【yasql】支持设置heading和feedback测试设计-3.详细测试设计)  
    -   [3.1 测试设计方法](#YDBRD25043【yasql】支持设置heading和feedback测试设计-3.1测试设计方法)  
    -   [3.2 详细测试设计](#YDBRD25043【yasql】支持设置heading和feedback测试设计-3.2详细测试设计)  
        -   [3.2.1 DFX测试](#YDBRD25043【yasql】支持设置heading和feedback测试设计-3.2.1DFX测试)  
        -   [3.2.2 等价类](#YDBRD25043【yasql】支持设置heading和feedback测试设计-3.2.2等价类)  
-   [4. 测试用例](#YDBRD25043【yasql】支持设置heading和feedback测试设计-4.测试用例)  
    -   [4.1 冒烟用例](#YDBRD25043【yasql】支持设置heading和feedback测试设计-4.1冒烟用例)  
    -   [4.2 文本用例](#YDBRD25043【yasql】支持设置heading和feedback测试设计-4.2文本用例)  
-   [5. 测试框架设计](#YDBRD25043【yasql】支持设置heading和feedback测试设计-5.测试框架设计)  
-   [6. 测试环境说明](#YDBRD25043【yasql】支持设置heading和feedback测试设计-6.测试环境说明)  
-   [7. 工作量评估](#YDBRD25043【yasql】支持设置heading和feedback测试设计-7.工作量评估)  


# 1. 概述

## 1.1 相关文档

SR:     [YDBRD-25043](https://jira.yasdb.com/browse/YDBRD-25043?src=confmacro)    -  【yasql】支持设置heading和feedback  完成

开发文档：    [开发文档：yasql支持设置参数控制heading和feedback](133585676.html)  

个人调研文档：    [1.6.0【个人调研】YDBRD-25043](https://conf.yasdb.com/pages/viewpage.action?pageId=141569159)  

调研文档：    [YDBRD-21980 测试调研(oracle)](https://conf.yasdb.com/pages/viewpage.action?pageId=133585734)  

概要设计：    [YDBRD-21980 测试概要设计](133585744.html)  

## 1.2 特性说明

yasql客户端工具支持特定set命令。

1) yasql支持set heading on /set heading off

**开启列标题的显示，当执行查询时，查询结果将包含列标题。**    
  2) yasql支持set feedback on/set feedback off

**开启查询反馈的显示，当执行查询时，查询结果将包含反馈信息，如返回的查询的行数。**

# 2. 需求分析

## 2.1 功能点分析

语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396bbda1ad9a3311dc8526/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTY2ODMsImV4cCI6MTc4MjMwNzQ4M30.ffQOqSTligsN382bCVT7cgON_vnNibaCOpebYRLfz54)

|set 参数名|默认|设置值|效果|语法|
|:---|:---|:---|:---|---|
|FEED[BACK] |ON |ON | OFF|ON   :开启回显（有反馈信息）,OFF  :关闭回显（有反馈信息）|SET FEED[BACK]   { ON | OFF}|
|HEA[DING]|ON |ON | OFF|ON   :  显示查询的列名（列标题）,OFF  :不  显示查询的列名（列标题）|SET HEA[DING] {ON | OFF}|


## 2.2 应用场景

1）  根据输出需要，在yasql使用set设置输出格式达到目标效果。

2）  帮助客户更灵活地  **控制查询结果的输出格式**  ，更容易理解和分析查询结果的含义。

3）具体场景

① 只需要数据本身：不  显示查询的列名  、关闭回显

② 生成报表：显示列名，关闭回显

③ 检查数据完整性：开启回显

## 2.3 规格约束

1）当前yasql进程生效。

2）feedback包括：    ‘Succeed.’  ‘PL/SQL Succeed.’ ‘ROW_NUM row/rows affected.’   ** **  **且语法当前只做on和off。   **  **sql、plsql的报错信息不会被off。（与Oracle一致）**

3）注意：同Oracle:  SET HEADING OFF 命令  **不会影响显示的列宽**  ，它只会控制列标题本身的打印。

4）   同Oracle:  heading 不作用于desc

  


# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略

如：内置函数入参–边界值；等价类 ；语法图–路径覆盖

1）使用等价类划分、边界值覆盖。

2）  set heading 针对表头（列名），元数据部分，     考虑表头长度、内容、表头长度规格等。

3）heading 主要是对 sql/plsql 结果中的非数据部分。作用于‘Succeed.’  ‘PL/SQL Succeed.’ ‘ROW_NUM row/rows affected.’, 字符串和长度几乎是固定的， 唯一可变的是ROW_NUM，在构造数据时主要考虑ROW_NUM的变化

构造表的时候，注意  **列名、**  数据类型、行数。

plsql构造的时候，结合set serveroutput on

## 3.2 详细测试设计

### 3.2.1 DFX测试

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT并发|否|无|
|KT|否|无|
|长稳|否|无|
|一致性|否|无|
|三方测试工具(sqltest，sqlancer)|否|无|
|安全|否|无|
|DFR故障|否|无|
|HA高可用|否|无|
|压力|否|无|
|性能|否|无|
|可维护性|否|无|


  


### 3.2.2 等价类

|  
|类别|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|1|功能校验|set heading on|显示表头信息|  
,  
|  
|  
|
|2|  
|set heading off|不显示表头信息|  
|  
|  
|
|3|  
|set feedback on|开启回显,Succeed.  ,PL/SQL Succeed. ,ROW_NUM row/rows affected.,  
|  
|**失败场景**,YAS-xxxxx|不属于feedback打印范围|
|4|  
|set feedback off|关闭回显|  
|  
|  
|
|5|  
|set heading、set feedback组合|①   set heading on;  set feedback on;,② set heading on;set feedback off;,③ set heading off;set feedback on;,④ set heading off;set feedback off;|①   显示表头信息；开启回显。,② 显示表头信息；关闭回显。,③ 不显示表头信息；开启回显。,④ 不显示表头信息；关闭回显。|  
|  
|
|6|  
|与yasql基本  功能  关联|yasql @<sqlfilename.sql>,yasql   -f [-e]<filename>,yasql   -c "SQL"|执行本地SQL文件,执行一个SQL文件。其中，“-e”显示执行的语句,运行单条语句后退出|  
|  
|
|7|  
|与yasql其它功能交互,注意：Oracle:  SET HEADING OFF 命令  **不会影响显示的列宽**  ，它只会控制列标题本身的打印。|-    **set num[width] <1~128>  **
-  set auto[commit] on|off   
- set timi[ng] on|off 
-  set DIRE[CTEXECUTE] on|off 
- desc
- show
- **ctrl + c / kill session**
-   [set autotrace on/off;](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SET%20AUTOTRACE.html)  
|命令设置显示宽度    
  事务自动提交    
  控制执行计时操作（每次执行结果会不同，手动验证即可，不能自动化）    
  来控制一次执行    
  获取数据库对象的描述信息     
  显示参数值    
  中止当前执行的SQL进程    
    
    
    
|  
|  
|
|8|  
|plsql|set serveroutput on;|  
|  
|  
|
|9|  
|**feedback对应 **  **不同sql类型**|**ddl、dml、dcl等**|  
|  
|  
|
|10|  
|权限|用户授权|  
|  
|  
|
|11|参数校验|set     入参 on/off|set feed     
  set feedb     
  set feedba     
  set feedbac     
  set feedback ,  
,  
|均可解析|  
|不可解析|
|12|  
|set feedback/  heading  入参|大小写、全称/简称,on,off|  
|参数名称、值不正确等|不可解析，报错拦截|
|13|  
|show|大小写、全称/简称,show feed,show feedb,show feedba,show feedbac,show feedback,  
,show hea,show head,show headi,show headin,show heading|  
|参数名称、值不正确等,show f,show fe,show fee,  
,  
,  
,show he|YASQL-00010 unknown SHOW option,  
,Oracle：,SP2-0158: 未知的 SHOW 选项 "ngg"|
|14|其他|登录方式和连接方式|**切换用户**,**conn**|相关性低,  
|  
|  
|
|15|  
|客户端字符编码|  
|相关性低|  
|  
|
|16|  
|不同的查询语句|- 多表连接（    [子查询](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#subquery)    、    [SET](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#setoper)    、    [JOIN](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#joinclause)    等）
- 排序    [ORDER BY](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#orderbyclause)  
- 分组    [GROUP BY](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#groupbyclause)  
-   [CASE](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#caseclause)  
-   [LIMIT](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#rowlimitingclause)  
-   [CTE](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#cteclause)  
-   [层次化/递归](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#hierarchicalqueryclause)  
-   [抽样](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#sampleclause)  
-   [指定分区](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#queryname)  
-   [指定切片](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#queryslice)    （Slice）
|相关性低|  
|  
|
|17|  
|查询表|普通表,分区表,分布表,嵌套表,临时表|相关性低|  
|  
|
|18|  
|查视图|  
|相关性低|  
|  
|
|19|  
|查存储过程|  
|相关性低|  
|  
|
|20|  
|列名|投影列，单列，多列，4096列|相关性低|  
|  
|
|21|  
|边界条件|空,特殊字符,大量数据|相关性低|  
|  
|
|22|  
|查询内容|- 正常值、
- 边界值、
- 空串、
- 空格、
- null、
- 特殊字符、
- 科学计数法、
- 大小写、
- 中文、
- 有效数据包含单双引号等
- 表情包
|相关性低|  
|  
|


  


# 4. 测试用例

## 4.1 冒烟用例

```
1.feedback语法正常回显、不回显功能正常
2.heading语法显示表头、不显示表头功能正常
3.结合yasql其他功能不出错
```

  


## 4.2 文本用例

  [YDBRD-25043.xlsx](#)  

属性表

  [TESTCASE_YDBRD-25043.csv](#)  

测试用例：

  [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/yasql/heading_feedback](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/yasql/heading_feedback)  

# 5. 测试框架设计

1） 自动化用例：Guider框架执行用例，生成预期，使用yasql模式执行。

# 6. 测试环境说明

1）辅助工具：①部署Guider脚本 ② 配置客户端、服务端字符集部署数据库脚本：    [https://git.yasdb.com/xiezhaoxian/scripts](https://git.yasdb.com/xiezhaoxian/scripts)  

2）测试环境：

|  
|CPU|操作系统|可用内存|可用磁盘空间|磁盘类型|
|:---|:---|:---|:---|:---|:---|
|192.168.7.97|Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz|Linux AchorBase 3.10.0-1160.el7.x86_64|35G|322G|HDD|


# 7. 工作量评估

工作量：2.5天

计划测试完成时间：0108

  


## Attachments: