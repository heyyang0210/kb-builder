Created by 吴水海, last modified on 七月 17, 2023

#   [YDBRD-14587 : SQL*LOADER支持单机列表LOB设计](#ydbrd-14587--sqlloader支持单机列表lob设计)  

  [YDBRD-14587](https://jira.yasdb.com/browse/YDBRD-14587)  

##   [1. Overview（概述）](#1-overview概述)  

SQL*LOADER已支持单机行表LOB导入，目前需要支持单机列表导入，客户端和服务端均支持

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 LOBFILE用法](#21-lobfile用法)  

(１) 语法描述

**说明**  ：支持全LOB导入，为动态LOB文件，涉及语法为TABLE_CLAUSE阶段。

- FILLER: 需要构造表中不存在的伪列，[ext_fname FILLER]，通过FILLER关键词表示，可出现column clause的不同位置，可被不同列引用，但不可重复声明同一filler；伪列可与表中列同名，但此时表中列不可被声明。且该伪列可不被引用。伪列不可用于condition的比较，报错处理。
- LOBFILE: 对于要导入的LOB列，[LOBCOL LOBFILE(ext_fname)]，用于江ext_fname中对应的lob文件导入lob列中。由于sqluldr2导出的csv文件路径是相对路径，默认补全在infile的目录下。


支持LOBFILE后存在terminated by eof子句，仅语法兼容且不支持别的关键字。

对于NULLIF子句，如果等号左边是指定LOBFILE的LOB列，如果是equal，恒为false；如果是not equal，恒为true。

```
LOAD DATA
INFILE 'sample.dat'
   INTO TABLE person_table
   FIELDS TERMINATED BY ','
   (name      CHAR(20),
    ext_fname    FILLER CHAR(40),
    "RESUME"     LOBFILE(ext_fname) TERMINATED BY EOF)
 
 
数据文件：sample.dat
Johny Quest,jqresume.txt,
Speed Racer,'/private/sracer/srresume.txt',
 
 
辅助数据文件：jqresume.txt
Johny Quest 500 Oracle Parkway ...
 
辅助数据文件：srresume.txt
         Speed Racer
     400 Oracle Parkway
        ...

```

###   [2.2 LLS用法](#22-lls用法)  

语法图：见图三

特别注意，nullif_clause字段只与指定的infile中对应列数据比较，若对应列包含LLS字段，仍与infile中对应列数据比较，而不是与对应列的LLS字段解析出的file进行比较。

LOB可以部分或整体加载，并且可以从任意位置和任意长度开始。SQL*Loader期望LLS字段的内容为 filename.ext.nnn.mmm/ 其中每个元素的定义如下：其中nnn和mmm只能为整数，因为采用  .   为分隔符解析信息。

filename.ext   是包含LOB的文件的名称。nnn  是文件中LOB的字节的偏移。该偏移大于lob文件大小则报错。该值小于0报错，0和1结果一致。oracle中文件大小为0时也报相同的错误，我们与oracle保持一致。mmm  是字节中的LOB的长度。值为-1和lob为null，0为空lob。该值小于-1就报错。正斜杠（/) 为终止字符，必须要有，有多余4个   .     的时候，不读  第四个   .    以后的数据，但仍需正斜杠(/)nnn+mmm大于lob文件大小时，从偏移位置一直导入至文件末尾。

##   [3.Specification And Constraints（规格与约束）](#3specification-and-constraints规格与约束)  

具体解释见    [语句定义](https://git.yasdb.com/cod-x/anchorbase/-/blob/master/doc/%E4%BA%A7%E5%93%81%E6%96%87%E6%A1%A3/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/LOAD%20DATA.md#%E8%AF%AD%E5%8F%A5%E5%AE%9A%E4%B9%89)  

##   [4. Detail Design（详细设计）](#4-detail-design详细设计)  

loader服务端会列转行，把列的数据拿出来按Row插入  

列表和行表的vm释放时机不同需要注意，放到row上是行的组织方式，并没有放到列的页面上，行在行表appendrow之后就放了vm，列应该在colbuilderPut后才进行free  

##   [5. TODO（遗留问题）](#5-todo遗留问题)  

1. 行导入BLOB规格目前为8000/2来判断inline和outline，CLOB为32000+lob列头（12字节）。（规格待统一，blob可能需要统一为32000/2+lob列头（12字节））
1. 行存BLOB数据select的数据长度减半。（导入数据8000，select的长度为4000）


![](https://pingcode.yasdb.com/atlas/files/public/67396aea8970c2af4f51ffe2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUNBQUFBQ0FBQUFBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFnUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAxMjEsImV4cCI6MTc4MjMwMDkyMX0.fXHyyiCTWtaO0SQfgz8WgxCP3cvx5rzd34M62GsT950)

![](https://pingcode.yasdb.com/atlas/files/public/67396aea8970c2af4f51ffe3/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUNBQUFBQ0FBQUFBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFnUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAxMjEsImV4cCI6MTc4MjMwMDkyMX0.fXHyyiCTWtaO0SQfgz8WgxCP3cvx5rzd34M62GsT950)

![](https://pingcode.yasdb.com/atlas/files/public/67396aeaa1ad9a3311dc7e5b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFRQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFCQUNBQUFBQ0FBQUFBQUFBQUFnQUFBQUNBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFnUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBRUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAxMjEsImV4cCI6MTc4MjMwMDkyMX0.fXHyyiCTWtaO0SQfgz8WgxCP3cvx5rzd34M62GsT950)

参考资料

-   [LSC表Outline LOB存储方案](https://conf.yasdb.com/pages/viewpage.action?pageId=104203899)  
-   [单机列存CLOB类型支持](https://conf.yasdb.com/display/YAS/LOB)  


## Attachments:

[image2023-5-30_17-40-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWE4OTcwYzJhZjRmNTFmZmRmIiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMTIxLCJleHAiOjE3ODIzNzY1MjF9.K2hiYvFH7Obey-6lgxiehpa7dqg2uiHbtOL-PRxin-o)

 (image/png)    


[image2023-5-30_17-49-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWFhMWFkOWEzMzExZGM3ZTU1IiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMTIxLCJleHAiOjE3ODIzNzY1MjF9.iFqGGhIHysV845OUNTRcu2bd5em3t06U4Dr5vEoHdYs)

 (image/png)    


[Lob.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWFhMWFkOWEzMzExZGM3ZTU2IiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMTIxLCJleHAiOjE3ODIzNzY1MjF9.Jee0K5pq-IR7GJ24LnyibYOYieW6-J2ckqNXh0ZXL7M)

 (image/png)    


[lob内存结构.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWFhMWFkOWEzMzExZGM3ZTU3IiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMTIxLCJleHAiOjE3ODIzNzY1MjF9.hHA1iAQTQ69q1fQmKBQIGryC0G7hIxL-xQny733r0Rk)

 (image/png)    


[SPF-LOB locator.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWFhMWFkOWEzMzExZGM3ZTU4IiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMTIxLCJleHAiOjE3ODIzNzY1MjF9.50xyZbQIE27PNWv2PgOcdu_vcD4gRfqsWeyPM5uTcDg)

 (image/png)    


[SPF-LOB locator.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZWFhMWFkOWEzMzExZGM3ZTU5IiwicmVmX2lkIjoiNjczOTZhZTk1OTNmOTljOWZmMjM1YjMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMTIxLCJleHAiOjE3ODIzNzY1MjF9.5qCI9hdiYmeYCVR8I1v2WhlC_99vz6EmWnt_3cdJU5M)

 (image/png)    
