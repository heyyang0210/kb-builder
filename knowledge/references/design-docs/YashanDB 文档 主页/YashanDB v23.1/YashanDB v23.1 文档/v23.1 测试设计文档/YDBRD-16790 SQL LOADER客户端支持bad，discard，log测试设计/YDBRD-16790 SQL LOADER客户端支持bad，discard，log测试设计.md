Created by 陈钦卿 on 十一月 14, 2023

# 1. 概述

SR:      [YDBRD-16790](https://jira.yasdb.com/browse/YDBRD-16790?src=confmacro)    -  SQL LOADER客户端支持bad，discard，log  完成

开发设计：    [YDBRD-16790: SQL LOADER客户端支持bad，discard，log - 贺国锋 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=122075331)  

  


**部署形态：单机、分布式**

# 2. 需求分析

## 2.1 功能点分析

### (1) ERRORS 因为多线程同时工作发送给服务端，服务端并不会因为达到上限而终止，且需要向客户端返回失败了几条，该结果可能不符合errors本义，超出该限制。

SQL loader的容错个数，当bad文件中的个数达到errors的个数，则会终止程序并退出。

并行场景下，所有线程均可修改该参数，故将该参数挂在loader上，并加锁访问。考虑到错误场景较少，加锁对性能影响较小。

**语法**  ： options(errors = parameter_value), parameter_value的最小值是0，最大值为Uint32，默认为50。

### (2) BADFILE

**语法**  ： BADFILE directory_path [filename]，目录需用单引号框起，如果指定到文件名，可不带后缀，会补全后缀bad。

**说明**  ：与INFILE的用法一致，不同点在于BADFILE可指定到目录，将在该目录下生成与csv文件同名的后缀为bad的文件，若是已存在该文件，将overwritten

**生成条件**     ：无论是否指定，只要有rejected数据就会生成。（Oracle说指定了才会生成，行为和说法不符）对于一些非法路径，如不存在，不进行报错，  当有rejected数据需要写入时，将之前的内容commit并报错退出  。 

**与Oracle不同**  ：

- 1.Oracle可单独指定文件名，但未见其在INFILE目录下及程序运行目录下生成，故我们不支持该种方式。且Oracle允许多文件情况下BADFILE同名，现象表现为覆盖，建议不允许生成同名的bad文件，若有，考虑到没有rejected数据不生成，故在execute阶段进行判断是否已生成同名文件，是否报错拦截。
- 2.如果指定的bad文件目录不存在，当bad数据存在于csv文件的最后一行时，Oracle会将bad数据前的内容commit并结束导入；当bad数据存在于中间时，对之前成功导入的内容不做commit。sqlldr对此的表现为将bad数据前已导入的内容进行commit，在log文件中记下相关报错并结束导入。
- 3.Oracle支持badfile或discardfile与infile同名，如badfile和infile同名，支持一边导入一边修改infile，infile有两条，多文件导入情况下生成的badfile有两条，后两条导入失败，在log文件中表现为记录3和记录4，我们会进行文件校验，同样是在执行阶段进行。


**何种数据会被放入BADFILE**  ：

- 1.类型转换失败的数据；
- 2.违反约束的数据；
- 3.不符合csv格式的数据。
- 4.未命中分区的数据。


只要被任意一张表reject，将不会插入，并写入bad文件中。如果没有生成bad文件的权限，继续导入但不写文件，  并在log文件中声明  。

### (3) DISCARDFILE（仅涉及客户端的binder线程）

**语法**  ：discard ::= DISCARDFILE directory_path [filename] [{ DISCARDS | DISCARDMAX } integer]，对于目录的指定方式同badfile，但默认后缀为dsc。

**说明**  ：directory_path部分同BADFILE，后可通过指定discardNum来选择丢弃的上限，达到上限后停止导入。该文件仅涉及客户端，仅用于跳过匹配全为null的情况。

**生成条件**  ：  不指定真的不生成

**与Oracle不同**  ：

- 1.discardNum为1，Oracle会在向文件中写入两条后终止，我们1就是1！
- 2.Oracle文档中说多文件情况下如果只指定了一次discardNum,将会应用于所有文件，实际表现并未如此，如果对于未指定的文件没有上限，我们的表现同Oracle的表现。


**何种数据会被放入DISCARDFILE**  ：

- 1.整行映射均为NULL的数据。


### (4) LOG

作为options存在，Oracle需要指定到目录或文件名，指定文件用法同file，log作为options中的参数存在，至少指定到文件名，可不带后缀，会补全后缀log。

如果不指定log参数，则在infile目录下生成同名文件，后缀为log

如果无法生成log文件，即没有权限情况下，导入报错终止。

**与Oracle不同**  ：

Oracle在任何场景下都会生成log文件，我们仅在导入申请到足够资源后进行导入。

如何区分阶段：跟csv数据相关报错及insert相关报错有关的均为执行阶段。

### (5) SILENT

默认为false。为true表示不生成记录文件，优先级高于LOG参数。

## 2.2 规格约束

- ERRORS 因为多线程同时工作发送给服务端，服务端并不会因为达到上限而终止，且需要向客户端返回失败了几条，该结果可能不符合errors本义，超出该限制。
- 对于bad和dsc文件，客户端支持相对路径，即支持.开头的
- 统计信息后打印到日志中，不再输出到控制台


  


# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

## 3.2 详细测试设计

[yasldr容错机制测试设计23.1.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTBhMWFkOWEzMzExZGM3ODAzIiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.Wh0onndvVXz1mSvpaNZ1dtkHzBoxMx07oKK-NTxFjF8)

#   
  4. 测试用例

#   
  5. 测试框架设计

本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。

# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式|


# 7.工作量评估

工作量：人天

计划测试完成时间：

## Attachments:

[列表支持OUTLINE_LOB导入测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTA4OTcwYzJhZjRmNTFmOTkwIiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.MKCJAkVfsQGQo24iWA-209NEw3pTmCxyH68ob0NcOJU)

 (application/x-xmind)    


[YDBRD-14587单机列表支持LOB导入测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTBhMWFkOWEzMzExZGM3ODA0IiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.P5ofkLpt-jpYKhLNrkSetGz0-Xlubd-TewliZ7FOtEM)

 (application/x-xmind)    


[sqlloader单机行表支持OUT_LINE LOB全导入 + LLS导入测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTA4OTcwYzJhZjRmNTFmOTkxIiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.BeqAN51Q4kxxpp96iHQDyEUC5jyu3C1_sBAB8JgceqQ)

 (application/x-xmind)    


[filler_column.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTBhMWFkOWEzMzExZGM3ODA2IiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.HXQLNAriMwVvTlfMqFJFpVA8hwIn3y_Fgnw3kezBBv8)

 (image/gif)    


[lob_column.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTA4OTcwYzJhZjRmNTFmOTkyIiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.r4fp8voConJ5zoXw3FiOcEoAllyiqcCTTU1zX0emMqA)

 (image/gif)    


[image2023-5-19_17-14-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTA4OTcwYzJhZjRmNTFmOTkzIiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.LdRE8Nu7jHreLcxvX41A7qgQIAz2y4-PU5cL7wIXsps)

 (image/png)    


[一步拆分到节点分区测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTBhMWFkOWEzMzExZGM3ODA3IiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.Ds5SdDlI1PoKJNqtQzVAbmlFu621JFYica6I9lJ3yPY)

 (application/x-xmind)    


[image2023-2-15_17-45-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTA4OTcwYzJhZjRmNTFmOTk0IiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.sJXHwl2AGH00sFHQ8R5s24tua-_wV2gUuOXyv33BsHk)

 (image/png)    


[image2023-2-15_17-46-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTE4OTcwYzJhZjRmNTFmOTk1IiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.aEjFiGS-Ev0SCZ0599EqP31_RNz6P3A9Rp9MfhCU8WA)

 (image/png)    


[yasldr容错机制测试设计23.1.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YTBhMWFkOWEzMzExZGM3ODAzIiwicmVmX2lkIjoiNjczOTY5YTA1OTNmOTljOWZmMjM1MGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA3ODE3LCJleHAiOjE3ODIyOTQyMTd9.Wh0onndvVXz1mSvpaNZ1dtkHzBoxMx07oKK-NTxFjF8)

 (application/x-xmind)    
