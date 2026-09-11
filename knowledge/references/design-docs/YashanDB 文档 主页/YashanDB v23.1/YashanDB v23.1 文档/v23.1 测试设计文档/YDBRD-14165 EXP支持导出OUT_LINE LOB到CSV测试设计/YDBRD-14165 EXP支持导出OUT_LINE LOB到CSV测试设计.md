Created by 范瑜, last modified on 十一月 14, 2023

# **1. 概述**

本文为 EXP支持导出OUT_LINE LOB到CSV测试设计

# **2. 需求分析**

## 2.1需求

SR:      [YDBRD-14165](https://jira.yasdb.com/browse/YDBRD-14165?src=confmacro)    -  EXP支持导出OUT_LINE LOB到CSV  完成  /    [YDBRD-12913](https://jira.yasdb.com/browse/YDBRD-12913?src=confmacro)    -  imp/exp支持分布式outline LOB  完成

开发设计：    [EXP支持导出OUT_LINE LOB到CSV - 侯忠林 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=112728940)  

## 2.2 功能描述

（1）将lob数据单独放置在一个ext结尾的一个文件中，源文件记录lob存放的文件信息和位置信息

（2）每一个表，每一个lob列一个单独的文件

（3）每一个lob一个单独的文件

## 2.3 功能限制

（1）此次只支持lls的格式

## 2.4 规格说明

（1）增加参数lob：lob=file、lob=lls

（2）lls功能：

- LOB位置指定器，在数据写入csv文件的时候，如果是lob，则将数据写入特定的ext文件，并在原来的csv文件中记录文件的名称，偏移位置和数据长度。每一个表，每一个lob列一个单独的ext文件
- 格式：    [filename.ext.nnn.mm/](http://filename.ext.nnn.mm/)  


      filename.ext是包含LOB的文件的名称，文件名称以(LOBXXXXX)命名

      nnn是文件中LOB的偏移量，以字节为单位

      mmm是LOB的长度，字节数。值为-1表示LOB为NULL。值为0意味着LOB存在，但为空。

     正斜线（/）是字段的结束语

# **3. 测试设计方法**   

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

功能测试：

|输入条件1|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|表类型|heap/tac/lsc,视图|待确认？|、临时表？|  
|
|分区类型|1、非分区,2、分区：,（1）hash,（2）range,（3）list,（4）复合分区|  
|  
|  
|
|列类型|blob、clob、其它数据类型|  
|  
|  
|
|列数|1、单列,2、多列,（1）全部是lob,（2）部分是lob,3、4096列， 同上|几个表存在相同的列名？|  
|  
|
|lob列值|1、长度：,（1）0、1,（2）小于32k,（3）大于32k,（4）规格? 4G,2、内容：,（1）clob：空格、空串、中文、英文、数字、特殊字符,（2）blob：图片、文档二进制流,（3）null|  
|  
|  
|
|lob列位置|1、第一列,2、中间列,3、最后一列|  
|  
|  
|
|表数据|1、空表,2、非空表|会有空文件|  
|  
|
|csv文件|1、内容：,（1）第一列、中间列、最后一列为lob,（2）lob前序列为空、空格、存在换行、双引号等,（3）中文、英文、数字,（4）特殊字符,2、大小：,（1）0,（2）其它|  
|  
|  
|
|结合导出功能|1、Common Options,（1）file,- 路径形式：绝对路径、相对路径
- 文件名：中、英文、数字等  (测试点无效)
- filename为lob+五位数，测试超过5位数场景
,（2）use-threads： 1、16等（根据表个数并发）,2、Export Options,（1）owner：中文， 英文大小写,（2）tables：,- 表名同owner
- 表个数：1个、16个、规格？
,3、CSV Options,（1）fields-enclosed-by： /、其它,（2）fields-terminated-by：/、其它|只有文件名？|  
|  
|
|结合导入功能|1、使用导出的csv文件进行导入|需要导入lob特性配合，不然很难校验结果|  
|  
|
|字符集|utf8、gbk、iso|  
|  
|  
|
|部署形态|单机|  
|分布式（另外有sr测试）、集群|  
|
|操作系统类型|linux、arm、windows|  
|  
|  
|
|其它|1、exp与数据库不在同一台机器上,2、本地存在同名lob文件，会覆盖,3、大数据量？|存在同名lob文件，会覆盖|  
|  
|


参数校验

|输入条件1|有效等价类|备注|无效等价类|备注|
|---|---|---|---|---|
|入参校验|lob = lls：    
  （1）大小写,（3）缺省，lob内容在csv文件中|  
|非法字符：,（1）–lob 空格,（2）--lob 其它字符，如带lls开头的字符,（3）lls带单双引号,  
|  
|
|出参校验|filename.ext：（以下测试点无效）最新形式为LOB+数字（不确定位数），需要测试超过五位数的场景,（1）长度,- 表名和列名分别为64个字符
- 小于64个字符
,（2）内容,- 列名带有ext
- 列名带有.
- 列名带有空格
- 几个表有同名列
- 英文大小写
- 中文
- 特殊字符等
,例如："test.ext.1.1"|  
|  
|  
|
|  
|nn：,（1）数据类型？long类型（无法覆盖到）,（2）最大值？,（3）0,（4）-1|  
|  
|  
|
|  
|mm: 同上|  
|  
|  
|


  


并发测试

|序号|测试场景|观察点|
|---|---|---|
|1|导出与ddl操作并发：,（1）drop table,（2）truncate table,（3）alter table：增删列、增删分区|1、导出的数据正确，保证一行数据正确,2、资源正常释放|
|2|导出与dml操作并发：,（1）update：lob大小由大到小，由小到大,（2）delete,（3）insert|  
|
|3|导出与dql并发|导出不受影响|
|4|并发向同一个目录导出数据|  
|


  


异常测试

|序号|测试场景|观察点|
|---|---|---|
|1|导出过程中磁盘满|1、除了工具异常后，其它异常后csv文件和lob文件需要同时被删除，,yasdb: csv文件删除了，lob文件没有删,sqludr2：待确认？,2、使用asan版本执行，关注工具、数据库资源是否释放|
|2|导出过程钟ctrl+c|  
|
|3|导出过程中导出文件被删除|  
|
|4|导出过程中数据库资源不足？（没有相关数据库配置）|  
|
|5|部分表不存在导出|  
|
|6|导出过程中网络异常|  
|
|7|导出过程中数据库节点异常|  
|


  


性能测试：

无性能测试sr和性能指标，此次只进行摸底

表结构：create table test_exp_outline_lob_56_02(c1 int, c2 clob, c3 clob, c4 clob)organization heap;

10行数据，总共大小：40G   导出耗时：244.277 s

  


# **4. 详细设计**

[outlineLob导出测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTZhMWFkOWEzMzExZGM3N2IxIiwicmVmX2lkIjoiNjczOTY5OTY1OTNmOTljOWZmMjM1MDRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTE5LCJleHAiOjE3ODIyOTM5MTl9._8F3sKFYBxqGV5HwGH0L4Qfzf6NWXwiC1drx_f5L3Zg)

# 5.   **测试用例**

#   
  6.   **测试框架设计**

本次测试采用导入导出测试框架实现，执行python脚本，对比期望结果与输出结果，输出测试结果。

# 7.   **测试环境说明**

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[outlineLob导出测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5OTZhMWFkOWEzMzExZGM3N2IxIiwicmVmX2lkIjoiNjczOTY5OTY1OTNmOTljOWZmMjM1MDRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3NTE5LCJleHAiOjE3ODIyOTM5MTl9._8F3sKFYBxqGV5HwGH0L4Qfzf6NWXwiC1drx_f5L3Zg)

 (application/x-xmind)    
