Created by 陈钦卿, last modified on 十一月 24, 2023

# 1. 概述

SR:      [YDBRD-22183](https://jira.yasdb.com/browse/YDBRD-22183?src=confmacro)    -  【yasldr】支持指定多个csv或目录的方式进行导入  完成

开发设计：    [Yasldr支持多文件导入 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133577146)  

  


**部署形态：**

（1）单机、分布式、集群

（2）服务端客户端都支持使用通配符筛选文件  --服务端不支持

**背景：**

（1）在很多小文件情况下， yasboot会启动多次yasldr进行导数，yasldr初始化成本比较高，会导致性能下降，多个文件一起导入，初始化占用成本会降低，提高导入性能

（2）在lsc表情况下，按照节点分区拆分是为了解决资源不足的问题，现在支持多个文件导入同样会出现资源不足问题

  


# 2. 需求分析

## 2.1 功能点分析

yasldr支持同时导入多个文件，包含多个写死文件名和使用通配符*/?指定多个文件。

### 1、语法

（1）语法同服务端多文件单表：

INFILE '/data/csv/csv01.csv'   FIELDS TERMINATED BY ',' BADFILE '/data/csv/csv01.bad' 

INFILE '/data/csv/csv02.csv' FIELDS TERMINATED BY ',' BADFILE '/data/csv/csv02.bad' DISCARDFILE '/data/csv/csv02.dsc'

INSERT INTO TABLE   ...

（2）*匹配零个或多个字符、?匹配单个字符：

INFILE '/data/csv/csv0  *  .csv'   FIELDS TERMINATED BY ',' BADFILE '/data/csv/csv01.bad' 

INFILE '/data/csv1/csv  ?  2.csv' FIELDS TERMINATED BY ',' 

INSERT INTO TABLE   ...

### 2、功能点

- 多个文件能正确导入单表，数据量正确
- 多个文件拆分正确
- 客户端支持infile的相对路径，./csv01.csv相对于当前路径。仅指定文件名infile 'csv01.csv'  ——需要支持


![](https://pingcode.yasdb.com/atlas/files/public/67396baa8970c2af4f520638/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUNBUUFBQUFRQUFBQUFBQUFBQVFBQUFBRUFBQUFBTUFBQUpBQUFBQUFBQUFBQUFFQ0FJQUFBQUFBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUpBQUFBQUFnQUNBQUFBQUFBQUFDQUFBQUFnQkFBQUFBQUFBQUFBQ0FBQUFBUUFBQUFBQ0FBQUFBQWdBQUlBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNTgsImV4cCI6MTc4MjMwNjk1OH0.gGVRLt1Qwz59cCHkoWX95-OsVMt0PJFm-fVbkUD5CFo)

## 2.2 应用场景

### 1、主要场景：

yasldr支持指定多个文件进行导入。

写死文件名不存在+通配符匹配到文件：报错写死文件名不存在，导入失败，表现同Oracle

![](https://pingcode.yasdb.com/atlas/files/public/67396baba1ad9a3311dc84ad/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUNBUUFBQUFRQUFBQUFBQUFBQVFBQUFBRUFBQUFBTUFBQUpBQUFBQUFBQUFBQUFFQ0FJQUFBQUFBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUpBQUFBQUFnQUNBQUFBQUFBQUFDQUFBQUFnQkFBQUFBQUFBQUFBQ0FBQUFBUUFBQUFBQ0FBQUFBQWdBQUlBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNTgsImV4cCI6MTc4MjMwNjk1OH0.gGVRLt1Qwz59cCHkoWX95-OsVMt0PJFm-fVbkUD5CFo)

![](https://pingcode.yasdb.com/atlas/files/public/67396baba1ad9a3311dc84ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUNBUUFBQUFRQUFBQUFBQUFBQVFBQUFBRUFBQUFBTUFBQUpBQUFBQUFBQUFBQUFFQ0FJQUFBQUFBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUpBQUFBQUFnQUNBQUFBQUFBQUFDQUFBQUFnQkFBQUFBQUFBQUFBQ0FBQUFBUUFBQUFBQ0FBQUFBQWdBQUlBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNTgsImV4cCI6MTc4MjMwNjk1OH0.gGVRLt1Qwz59cCHkoWX95-OsVMt0PJFm-fVbkUD5CFo)

通配符匹配到文件+写死文件名不存在：Oracle--导入一条，报错写死文件名不存在；yasdb--直接报错写死文件名不存在

![](https://pingcode.yasdb.com/atlas/files/public/67396baba1ad9a3311dc84b0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUNBUUFBQUFRQUFBQUFBQUFBQVFBQUFBRUFBQUFBTUFBQUpBQUFBQUFBQUFBQUFFQ0FJQUFBQUFBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUpBQUFBQUFnQUNBQUFBQUFBQUFDQUFBQUFnQkFBQUFBQUFBQUFBQ0FBQUFBUUFBQUFBQ0FBQUFBQWdBQUlBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNTgsImV4cCI6MTc4MjMwNjk1OH0.gGVRLt1Qwz59cCHkoWX95-OsVMt0PJFm-fVbkUD5CFo)

![](https://pingcode.yasdb.com/atlas/files/public/67396baba1ad9a3311dc84b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUNBUUFBQUFRQUFBQUFBQUFBQVFBQUFBRUFBQUFBTUFBQUpBQUFBQUFBQUFBQUFFQ0FJQUFBQUFBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUpBQUFBQUFnQUNBQUFBQUFBQUFDQUFBQUFnQkFBQUFBQUFBQUFBQ0FBQUFBUUFBQUFBQ0FBQUFBQWdBQUlBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNTgsImV4cCI6MTc4MjMwNjk1OH0.gGVRLt1Qwz59cCHkoWX95-OsVMt0PJFm-fVbkUD5CFo)

### 2、容错场景下

（1）指定log/bad/dsc文件：

- 无通配符时：按照指定的文件生成相应记录文件；若多个infile指定同一个badfile，则bad数据以  追加  的形式写入badfile
- 有通配符时：eg：INFILE '/data/csv/csv0  *  .csv'   FIELDS TERMINATED BY ',' BADFILE '/data/csv/csv01.bad' DISCARDFILE '/data/csv/csv01.dsc'。bad数据和dsc数据会以  追加  的形式写入bad文件和dsc文件中，控制台打印提示？


（2）不指定log/bad/dsc文件：

- 无通配符时：仅生成一个与第一个infile同名的以.log为后缀的log文件，生成与各个infile同名的以.bad为后缀的bad文件，不生成dsc文件。
- 有通配符时：  eg：INFILE '/data/csv/csv0  *  .csv'   FIELDS TERMINATED BY ','。仅生成一个与第一个匹配到的infile同名的以.log为后缀的log文件，生成与各个infile同名的以.bad为后缀的bad文件，不生成dsc文件。


（3）log日志：

- 打印各数据文件所对应的错误文件和废弃文件路径


![](https://pingcode.yasdb.com/atlas/files/public/67396bab8970c2af4f52063b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUNBUUFBQUFRQUFBQUFBQUFBQVFBQUFBRUFBQUFBTUFBQUpBQUFBQUFBQUFBQUFFQ0FJQUFBQUFBQUFBQUFBQ0FFQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUpBQUFBQUFnQUNBQUFBQUFBQUFDQUFBQUFnQkFBQUFBQUFBQUFBQ0FBQUFBUUFBQUFBQ0FBQUFBQWdBQUlBQUFBQUFBQUFFPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTYxNTgsImV4cCI6MTc4MjMwNjk1OH0.gGVRLt1Qwz59cCHkoWX95-OsVMt0PJFm-fVbkUD5CFo)

### 3、多文件场景下，  文件如何拆分：

目前拆分后的数据文件命名为：0.csv、1.csv

- split
- split_to_part


多文件指定不同分隔符，拆分后？—— 保持现状

多个文件拆到一个文件

### 4、多文件场景下，统计信息如何统计？如何输出到log文件中？

### 5、yasboot暂且不考虑 —— 有其他sr规划

yasboot支持多文件？—— 调用yasldr，yasboot能否正常导入多文件，或者报错。  未匹配到文件时——报错

一键拆分导入

## 2.3 规格约束

1、不支持指定导入多张表

2、多文件导入时，最多支持250个文件同时导入一张表，这一点和服务端导入保持一致。

3、不会匹配子目录下的文件

4、若匹配到bad和dsc文件，报错？（eg：/data/csv/csv*下存在文件/data/csv/csv01.bad）

5、  当使用*或？通配符时，若后面跟随的INFILE指定的文件与通配符匹配的文件重名，则报重名错误，这一点和使用多个INFILE指定时保持一致。

# 3. 详细测试设计

## 3.1 测试设计方法

主要采用的等价类划分，边界值，场景法组合及错误推测法进行设计

## 3.2 详细测试设计

[yasldr支持多文件导入.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWFhMWFkOWEzMzExZGM4NGEzIiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.xDtl_35y-e1Xgnl3TJh9dlz5pKgB_m905GXmYJjz6Es)

#   
  4. 测试用例

文本用例：

[yasldr支持多文件文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWE4OTcwYzJhZjRmNTIwNjJlIiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.af02bRuMbC5EsCaQIDoZxZi3KUygknWhMKBtqHOsHrg)

#   
  5. 测试框架设计

本次测试采用exp_imp_test测试框架实现，执行py文件，对比期望结果与输出结果，输出测试结果。

# 6. 测试环境说明

|**服务器**|** **|
|:---|:---|
|操作系统|Linux|
|部署|单机、分布式、集群|


# 7.工作量评估

工作量：人天

计划测试完成时间：

## Attachments:

[image2023-10-17_14-26-48.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWFhMWFkOWEzMzExZGM4NGE1IiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.uJU1UWj4Px-IAVQgfRflkpvCfh9NHqbEqGG2J2H3RF8)

 (image/png)    


[image2023-10-17_14-27-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWFhMWFkOWEzMzExZGM4NGE2IiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.nJG-2aJvYKxK1kqcHYct9r9Fl03Du2KqeZueV8-XCcM)

 (image/png)    


[image2023-10-17_14-31-38.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWFhMWFkOWEzMzExZGM4NGE3IiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.bvKS1StkC4fHbFDZ1OjPKJjbkP3RMmxzC6IsYuT5_EI)

 (image/png)    


[image2023-10-17_14-33-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWFhMWFkOWEzMzExZGM4NGE4IiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.B6clNSqtUGte-G_NYM3P5qQe4c3XZ6yWemj5iwplHnQ)

 (image/png)    


[image2023-10-19_11-33-25.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWE4OTcwYzJhZjRmNTIwNjMxIiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.XVSW3nkURHyxIWNvaEeLhIgQWiiUWUq1QYBESuAyjQ8)

 (image/png)    


[image2023-10-19_11-35-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWE4OTcwYzJhZjRmNTIwNjMyIiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.Iw_XhFL_-iba5SDPYHLlVbUhAF9Ock9V49hrSad7jSM)

 (image/png)    


[yasldr支持多文件导入.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWFhMWFkOWEzMzExZGM4NGEzIiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.xDtl_35y-e1Xgnl3TJh9dlz5pKgB_m905GXmYJjz6Es)

 (application/x-xmind)    


[yasldr支持多文件文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWFhMWFkOWEzMzExZGM4NGFhIiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.zfU0VS3MGnGr_PlLU8PNylm9f5boGTWfsMk3Nno3yak)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[yasldr支持多文件文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiYWE4OTcwYzJhZjRmNTIwNjJlIiwicmVmX2lkIjoiNjczOTZiYWE1OTNmOTljOWZmMjM2NTdhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk2MTU4LCJleHAiOjE3ODIzODI1NTh9.af02bRuMbC5EsCaQIDoZxZi3KUygknWhMKBtqHOsHrg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    
