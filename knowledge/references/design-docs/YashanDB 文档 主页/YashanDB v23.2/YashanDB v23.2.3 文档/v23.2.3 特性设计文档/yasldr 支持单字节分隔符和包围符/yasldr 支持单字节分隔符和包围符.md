Created by 程康, last modified on 五月 07, 2024

https://pingcode.yasdb.com/pjm/items/661156fc579a3edb84d68ead?    
  #YDBRD-19209   【  yasldr  】支持指定单字节分隔符和包围符

##   [1. 总述](#1-总述)  

场 景：

1、yasldr导入支持指定数据分隔符、数据包围符号    
    
  需求描述：    
  yasldr导入支持指定数据分隔符、数据包围符号    
    
  需求范围：    
  分布式

###   [1.1 需求来源](#11-需求来源)  

###   [1.2 调研文档](#12-调研文档)  

oracle 支持指定分隔符 、包围符

```
[root@AchorBase exp]# cat ck_oracle.ctl 
LOAD DATA
INFILE '/exp/ck_oracle.csv'
append
INTO TABLE ck_test
fields terminated by '??'
optionally enclosed by '**'
(a,b)


[root@AchorBase exp]# cat ck_oracle.csv 
**xxx**??*ppp*
ppp??xxx


[root@AchorBase exp]# sqlldr CONTROL=/exp/ck_oracle.ctl userid=c##ck1/1
SQL*Loader: Release 19.0.0.0.0 - Production on Wed Feb 21 15:34:51 2024
Version 19.3.0.0.0

Copyright (c) 1982, 2019, Oracle and/or its affiliates.  All rights reserved.

Path used:      Conventional
Commit point reached - logical record count 2

Table CK_TEST:
  2 Rows successfully loaded.

Check the log file:
  ck_oracle.log
for more information about the load.
```

###   [1.3 需求分析](#13-需求分析)  

###   [1.4 数据字典](#14-数据字典)  

###   [1.5 开源依赖](#15-开源依赖)  

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

需求规格：    
  1、分隔符    
  1）单字节分隔符，如单引号    
  2、数据包围符号    
  1）单字节包围符

  


现状：

![](https://pingcode.yasdb.com/atlas/files/public/67396d3ea1ad9a3311dc8fd2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5MTMsImV4cCI6MTc4MjMxNzcxM30.U-BnG-85FIL56DjCKpsyeu8S9-FfsNB3rFAoCqliCTc)

分割符支持：ascii 1-126，除过字母，数字，换行符

包围符支持：ascii 1-126，除过换行符，除过空格

包围符 与 分隔符不能相同

**备注：**

**单引号使用转义：‘ → ‘’**

**双引号使用转义：” → \"**

**反引号使用转义：` → \`**

  


**空格输入形式：**

**    十六进制或十进制表示 yasldr sys/Cod-2022 control_text="'load data infile '/data/exp/test2' fields terminated by 32 optionally enclosed by 0x1 into table test2(c1,c2)'"**

  


**lob lls 导入：当包围符含有文件中任意字符 类似（ LOB00000.ext.10.3/ ），会无法正常识别匹配的包围符**

##   [4. 特性](#4-特性)  

  


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

  


##   [6.资料设计章节](#6资料设计章节)  

修改相应terminated by 和 enclosed by的描述

##   [7.未来规划](#7未来规划)  

  


  


## Attachments:

[image2024-1-19_16-15-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2VhMWFkOWEzMzExZGM4ZmNkIiwicmVmX2lkIjoiNjczOTZkM2U1OTNmOTljOWZmMjM3OTRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTEzLCJleHAiOjE3ODIzOTMzMTN9.ev9syaVMdpM038Z4ckpZ-BA1h30GAnOblJcnhCTwTbA)

 (image/png)    


[image2024-1-19_16-13-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2U4OTcwYzJhZjRmNTIxMTVlIiwicmVmX2lkIjoiNjczOTZkM2U1OTNmOTljOWZmMjM3OTRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTEzLCJleHAiOjE3ODIzOTMzMTN9.Hi7PgmEPG5pM45Fro2jrD3qvgiRFi4iqSEikLPfnrBU)

 (image/png)    


[image2024-2-21_14-30-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2U4OTcwYzJhZjRmNTIxMTVmIiwicmVmX2lkIjoiNjczOTZkM2U1OTNmOTljOWZmMjM3OTRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTEzLCJleHAiOjE3ODIzOTMzMTN9.K9el7J14uYkQqIqB9lplfDDQPFWo8Ch0oOtg-H93HGY)

 (image/png)    


[image2024-2-22_9-10-1.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2VhMWFkOWEzMzExZGM4ZmNmIiwicmVmX2lkIjoiNjczOTZkM2U1OTNmOTljOWZmMjM3OTRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTEzLCJleHAiOjE3ODIzOTMzMTN9.xa2gDt-22tBKiPwXWxUcF16SWSZn_XKUiwh6S9LkdZ4)

 (image/png)    


[image2024-4-26_9-57-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2VhMWFkOWEzMzExZGM4ZmQwIiwicmVmX2lkIjoiNjczOTZkM2U1OTNmOTljOWZmMjM3OTRmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTEzLCJleHAiOjE3ODIzOTMzMTN9.X3aAyryKXvZwFXkLZjPlnKeLRliYGBe7mfs-br1pSSo)

 (image/png)    


## Comments:

|  [](null)  ,1、支持单字节的范围,2、oracle是否 分隔符和包围符相同时校验-- 报错，导入失败,3、转义包围符,Posted by chengkang at 四月 24, 2024 15:35|
|---|
