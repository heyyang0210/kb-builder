Created by 谢昭贤 on 十月 13, 2024

# YDBRD-26417 【yasldr】分区边界通过查询服务端分区边界二进制解码

  


-   [YDBRD-26417 【yasldr】分区边界通过查询服务端分区边界二进制解码](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-YDBRD-26417【yasldr】分区边界通过查询服务端分区边界二进制解码)  
-   [](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-)  
-   [1. 概述](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-1.概述)  
    -   [1.1 相关文档](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-1.1相关文档)  
    -   [1.2 特性说明](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-1.2特性说明)  
-   [2. 需求分析](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-2.需求分析)  
    -   [2.1 功能点分析](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-2.1功能点分析)  
    -   [2.2 应用场景](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-2.2应用场景)  
    -   [2.3 规格约束](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-2.3规格约束)  
-   [3. 详细测试设计](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-3.详细测试设计)  
    -   [3.1 测试设计方法](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-3.1测试设计方法)  
    -   [3.2 详细测试设计](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-3.2详细测试设计)  
        -   [3.2.1 DFX测试](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-3.2.1DFX测试)  
        -   [3.2.2 等价类](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-3.2.2等价类)  
-   [4. 测试用例](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-4.测试用例)  
    -   [4.1 冒烟用例](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-4.1冒烟用例)  
    -   [4.2 文本用例](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-4.2文本用例)  
-   [5. 测试框架设计](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-5.测试框架设计)  
-   [6. 测试环境说明](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-6.测试环境说明)  
-   [7. 工作量评估](#YDBRD26417【yasldr】分区边界通过查询服务端分区边界二进制解码-7.工作量评估)  


# 1. 概述

## 1.1 相关文档

需求来源：     [https://pingcode.yasdb.com/pjm/items/66116bbf579a3edb84d703f4](https://pingcode.yasdb.com/pjm/items/66116bbf579a3edb84d703f4)    ? #YDBRD-20970 【yasldr】给list 分区表mode=batch导入报错 YAS-00008 type convert error : not a valid number

问题原因：分区创建时分区键使用lpad函数构造，而yasldr客户端导入不支持分区键中含有计算函数

SR:     [https://pingcode.yasdb.com/pjm/items/661df90dfd997db58ada635d](https://pingcode.yasdb.com/pjm/items/661df90dfd997db58ada635d)    ? #YDBRD-26417 【yasldr】分区边界通过查询服务端分区边界二进制解码

开发设计文档：    [YDBRD-26417：分区边界查询服务端二进制方案设计说明书](150616290.html)  

参考文档       [7.2 bulkload/非bulkload导入质量加固详细测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=144142088)  

## 1.2 特性说明

yasldr客户端导入支持定义分区键值中含有计算函数。

（yasldr导入数据时，获取分区边界值需要和服务端一样，通过查询系统视图后解码，而不是通过原始定义自己解析。）

# 2. 需求分析

## 2.1 功能点分析

- 对功能/需求进行详细说明及分析，对应提供的功能点、函数、语法图、配置参数、视图、接口等；
- 开发设计的主要原理


语法图：

  


|语法|作用|  
|
|:---|:---|---|
|  
|  
|  
|


  


## 2.2 应用场景

- 需求本身的主要应用场景
- 需求与其他特性的关联场景


1）yasldr客户端导入支持定义分区键值中含有计算函数

2）

## 2.3 规格约束

1）验证交付部署形态：  **单机、分布式、集群**

2）  新增视图的权限和ALL_TABLE_PARTITIONS保持一致    


3）实现后，仅支持创建分区表时分区键使用函数，  **且函数的结果是确定值的场景，**

4）batch方式涉及，basic模式不涉及

5）分区边界是按照服务端的字符集保存的，驱动层在比较数据和分区边界时，需要将数据先按照服务端的字符集做转换，然后与分区边界值做比较。

6）

  


# 3. 详细测试设计

## 3.1 测试设计方法

对本测试设计中使用的工程方法及适用的场景分类做说明，如常用的边界值，等价类，流程图及相关的组合策略

如：内置函数入参–边界值；等价类 ；语法图–路径覆盖

1）使用等价类划分、边界值覆盖

## 3.2 详细测试设计

### 3.2.1 DFX测试

|系统级DFX分类|是否涉及|测试点|
|---|---|---|
|CT并发|否|  
|
|KT|否|  
|
|长稳|否|  
|
|一致性|否|  
|
|三方测试工具    
  (sqltest，sqlancer)|否|  
|
|安全|否|  
|
|DFR故障|否|  
|
|HA高可用|否|  
|
|压力|否|  
|
|性能|否|  
|
|可维护性|否|  
|


### 3.2.2 等价类

分区表参考：    [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/partition_table](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/partition_table)  

函数参考：    [https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function1](https://git.yasdb.com/cod-test/yasft/-/tree/master/standalone/testcase/function1)      、     [内置函数](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html)  

  


|序|类别|输入条件|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|---|---|
|1|功能校验|分区键中含有计算函数,  
,不同的数据类型，对应不同的计算函数|支持创建分区表时分区键使用函数，,**且函数的结果是确定值的场景**,  
,函数参考范围：(  **稳定函数**  、可变函数),  
,  
    
    [字符函数（Character Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E5%AD%97%E7%AC%A6%E5%87%BD%E6%95%B0-character-function)      
    [数学函数（Mathematical Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E6%95%B0%E5%AD%A6%E5%87%BD%E6%95%B0-mathematical-function)      
    [转换函数（Conversion Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E8%BD%AC%E6%8D%A2%E5%87%BD%E6%95%B0-conversion-function)      
    
,  [其他函数（Other Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E5%85%B6%E4%BB%96%E5%87%BD%E6%95%B0-other-function)  ,  
,考虑常用函数（例如一些转换函数）|```
CREATE TABLE YDBRD22548_BATCH_INSERT_13 ( 
    col1 tinyint,col2 smallint,col3 int,col4 bigint,col5 float,
    col6 number(10,2),col7 double,col8 date,col9 timestamp,col10 varchar(10),
    col11 char(20),col12 varchar2(1000),col13 time,col14 INTERVAL YEAR(9) TO MONTH,
    col15 INTERVAL DAY(9) TO SECOND,col16 nchar(10),col17 raw(20),col18 clob,col19 json,
    col20 urowid/*col21 gemo,col22 blob,col23 rowid,col24 bit(4)*/) 
    partition by list(col1,col10) 
    (partition part_1 values (
        (1,lpad('c0'||(1%4),10,'c2')), (2,lpad('c0'||(2%4),10,'c2')), (3,lpad('c0'||(3%4),10,'c2')), 
        (4,lpad('c0'||(4%4),10,'c2')), (5,lpad('c0'||(5%4),10,'c2')), (6,lpad('c0'||(6%4),10,'c2')), 
        (7,lpad('c0'||(7%4),10,'c2')), (8,lpad('c0'||(8%4),10,'c2')), (9,lpad('c0'||(9%4),10,'c2'))
    ), 
    partition part_2 values (
        (10,lpad('c0'||(10%4),10,'c2')), (11,lpad('c0'||(11%4),10,'c2')), (16,lpad('c0'||(16%4),10,'c2')), 
        (18,lpad('c0'||(18%4),10,'c2')), (20,lpad('c0'||(20%4),10,'c2')), (22,lpad('c0'||(22%4),10,'c2')), 
        (25,lpad('c0'||(25%4),10,'c2'))), 
    partition part_3 values (default) );
```|函数的结果  **是不确定值/ 一些无法创建的函数**,  
,  
,  
,  
,  [聚集函数（Aggregate Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E8%81%9A%E9%9B%86%E5%87%BD%E6%95%B0-aggregate-function)  ,  [日期函数（Datetime Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E6%97%A5%E6%9C%9F%E5%87%BD%E6%95%B0-datetime-function)  ,  [NLSSORT](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/NLSSORT)  ,  [RANDOM](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/RANDOM)  ,  [窗口函数（Window Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E7%AA%97%E5%8F%A3%E5%87%BD%E6%95%B0-window-function)  ,  [数组函数（Varray Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E6%95%B0%E7%BB%84%E5%87%BD%E6%95%B0-varray-function)      
    [内置表函数（Table Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E5%86%85%E7%BD%AE%E8%A1%A8%E5%87%BD%E6%95%B0-table-function)  ,  [地理信息处理函数（GIS Function）](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E5%9C%B0%E7%90%86%E4%BF%A1%E6%81%AF%E5%A4%84%E7%90%86%E5%87%BD%E6%95%B0-gis-function)      
    
    
|  
|
|2|  
|  
|  
|  
|  
|  
|
|3|  
|**分区类型**,  [#table-partition-clause](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html#table-partition-clause)  ,  
,  
|range,list|- 不允许为    [临时表](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html#temptable)    创建分区。
- 不允许将LOB列/JSON列指定为分区键和子分区键。
|hash_partitions|  
|
|4|  
|组合分区|range range,range list,range hash,  
,list range,list list,list hash,  
,hash range,hash list|  
|hash hash,  
|创建组合分区时，一级分区不能指定为INTERVAL类型的范围分区（range_partitions）。|
|5|  
|**分区键**|数值型：,（1）整数类型：tinyint、smallint、int、bigint,（2）浮点类型：float、double,（3）number类型：number,  
,字符型：,（1）定长类型：char、nchar、char(size （char）),  
,布尔型,     boolean,  
,日期类型：,（1）日期时间类型：date、time、timestamp,（2）间隔类型：interval  year to month、interval day to second,  
,row urowid |  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,  
,row(分布式部署中无法作为分区键)   、   YashanDB内部将UROWID等同于    [RAW](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E6%95%B0%E6%8D%AE%E7%B1%BB%E5%9E%8B/RAW)    类型，因此UROWID使用规则与RAW使用规则完全一致。|**不能作分区键**,**blob clob varcar nvarchar bit nclob rowid xmltype**|  
|
|6|  
|多个分区键|  
|  
|  
|  
|
|7|  
|分区键值|数值型：,（1）整数类型：null、边界值,（2）浮点类型：null、边界值、inf、-inf、nan,（3）number类型：null、边界值,  
,字符型：,（1）定长类型：null、空串、空格、自定义边界长度、类型边界长度、特殊字符(表情包、中文、其它国语言),  
,布尔型：null,（1）字符型：  'true'、't'、 'yes'、 'y'、 'on'、 '1'、'false'、'f'、 'no'、 'n'、 'off'、 '0',（2）标识符：true、false,（3）整形数值：非0整数、0,  
,日期类型：,（1）日期时间类型：null、时间边界、时间格式，如只有年-月无日等,（2）间隔类型：null、时间边界、时间格式，缺少部分时间等,  
,row    urowid , （1）变长二进制串|考虑 ,分区边界值非常大或非常小,  
,null 属于 maxvalue|  
|  
|
|8|  
|**分区条件**|  
|构造： csv的值，导入后对应的分区|  
|  
|
|9|功能校验|导入后查询|数据是否处于对应的分区|  
|  
|  
|
|10|  
|视图  **相关用例刷新**|IMU_ALL_TAB_PARTITIONS,IMU_ALL_TAB_SUBPARTITIONS|  
|  
|  
|
|11|场景校验|视图权限|表的所属用户与导入用户，权限不同,用户1 创建分区表，使用用户2 给用户1的表导数据。     **给用户2操作用户1表的权限。**|权限和ALL_TABLE_PARTITIONS保持一致|使用用户2 给用户1的表导数据。用户2没有用户1的表的权限|  
|
|12|  
|新增视图、考虑数据库升级|  
|  
|  
|  
|
|13|  
|考虑视图导入导出前后，本身元数据是否正确|结合exp/imp|  
|  
|  
|
|14|场景校验|兼容性,23.2.1 的客户端与23.2.2补丁数据库的兼容性|23.2.1客户端、23.2.2服务端,23.2.2客户端、23.2.1服务端|  
|  
|  
|
|15|  
|  
|  
|  
|  
|  
|
|16|场景校验|字符集|  
|   分区边界是按照服务端的字符集保存的，驱动层在比较数据和分区边界时，需要将数据先按照服务端的字符集做转换，然后与分区边界值做比较。|  
|  
|
|17|  
|  
|  
|  
|  
|  
|
|18|  
|  
|  
|  
|  
|  
|
|19|  
|  
|  
|  
|  
|  
|
|20|  
|  
|  
|  
|  
|  
|
|21|  
|  
|  
|  
|  
|  
|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


## 4.1 冒烟用例

```
1.
```

  


## 4.2 文本用例

文本用例：

  [YDBRD-26417.xlsx](#)  

# 5. 测试框架设计

1） 自动化用例：

使用导入导出框架进行测试    [https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/exp_imp_test)  

# 6. 测试环境说明

测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等

1）辅助工具：

Guider部署、执行、字符集配置脚本：    [https://git.yasdb.com/xiezhaoxian/scripts](https://git.yasdb.com/xiezhaoxian/scripts)  

2）测试环境：

|  
|CPU|操作系统|可用内存|可用磁盘空间|磁盘类型|
|:---|:---|:---|:---|:---|:---|
|192.168.7.97|Intel(R) Xeon(R) Gold 6230R CPU @ 2.10GHz|Linux AchorBase 3.10.0-1160.el7.x86_64|35G|322G|HDD|


# 7. 工作量评估

工作量：天

计划测试完成时间：

  
