Created by 程康, last modified on 五月 07, 2024

https://pingcode.yasdb.com/pjm/items/661156da579a3edb84d68e2b?    
  #YDBRD-19198   【  exp  】支持指定分隔符，含不可见字符

##   [1. 总述](#1-总述)  

exp 导出csv文件，可指定分隔符

###   [1.1 需求来源](#11-需求来源)  

1、银行实际业务中一般使用不可见字符，例如27等，    
  2、也有各行规范：#等，每个银行要求规范都不一样

###   [1.2 调研文档](#12-调研文档)  

###   [1.3 需求分析](#13-需求分析)  

  [1.4 数据字典](#14-数据字典)  

不涉及

###   [1.5 开源依赖](#15-开源依赖)  

不涉及

##   [2. 接口](#2-接口)  

exp --csv -f csv -u regress -O regress -p regress -T test_partial_packet   --fields-terminated-by   0x06      *--fields-enclosed-by 0x7*

对于  *  --lines-terminated-by 不做修改*

##   [3. 规格与约束](#3-规格与约束)  

支持范围参考yasldr，两边能力对等即可

  [yasldr 支持单字节分隔符和包围符 - 程康 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=144131150)  

分割符支持：ascii 1-126，除过字母，数字，换行符

包围符支持：ascii 1-126，除过换行符，除过空格

  


**使用限制：**

**直接使用命令行输入 **

**           十六进制输入：--fields-terminated-by 0x02**

**           十进制输入：暂不支持**

**           字符输入：--fields-terminated-by 2**

**使用ctl文件输入**

**           十六进制输入:  fields-terminated-by = 0x02**

**           十进制输入：暂不支持**

  


**包为辐与数据一致时，数据需要double进行转义**

  


**备注：**

**单引号使用转义：‘ → ‘’**

**双引号使用转义：” → \" **

**反引号使用转义：` → \`**

  


**导出lob lls：分隔符与包为辐不受限制。**

  


##   [4. 特性](#4-特性)  

  [YashanDB Doc](https://doc.yashandb.com/yashandb/23.1/zh/%E5%B7%A5%E5%85%B7%E6%89%8B%E5%86%8C/exp/CSV%E6%96%87%E4%BB%B6%E5%AF%BC%E5%87%BA.html)  

```
exp --csv -f csv -u regress -O regress -p regress -T test_partial_packet --fields-terminated-by 0x06

yasldr regress/regress control_text="'load data options(degree_of_parallelism=3) infile '/exp/yasdb/test_partial_packet' fields terminated by 0x06 into table test_partial_packet(col1,col2,col3,col4,col5)'"
```

支持字符表示，十六进制表示，十进制表示

##   [5. Testcases（自测用例）](#5-testcases自测用例)  

|  
|是否支持十进制|是否支持十六进制|是否支持字符|是否支持数字，字母|
|---|---|---|---|---|
|yasldr分隔符|是|是|是|否|
|yasldr包围符|否|否|是|是|
|exp分隔符|是|是|是|否|
|exp包围符|是|是|是|是|


##   [6.资料设计章节](#6资料设计章节)  

修改官方文档描述

##   [7.未来规划](#7未来规划)  

  


  


## Attachments:

[image2024-1-19_16-15-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWJhMWFkOWEzMzExZGM5MGI0IiwicmVmX2lkIjoiNjczOTZkNWI1OTNmOTljOWZmMjM3YTc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjQ0LCJleHAiOjE3ODIzOTQwNDR9.D0gLtlsChPM-VWu89CwHfe2-6DDsfJZa_z-97bRAZeY)

 (image/png)    


[image2024-1-19_16-13-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNWI4OTcwYzJhZjRmNTIxMjQ1IiwicmVmX2lkIjoiNjczOTZkNWI1OTNmOTljOWZmMjM3YTc3IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA3NjQ0LCJleHAiOjE3ODIzOTQwNDR9.qM-4W4q1461FSgtY5yf3zDmHWjr96Hf8pO4ghl2pgI8)

 (image/png)    


## Comments:

|  [](null)  ,1、包围符支持---- 目前exp --csv 的包围符 支持逻辑为单字节字符均支持，但只支持字符表示，无法用十进制，十六进制表示包为辐,2、支持 字符形式，十六进制，十进制,Posted by chengkang at 四月 24, 2024 15:50|
|---|
