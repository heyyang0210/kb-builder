Created by 吴水海, last modified on 七月 17, 2023

#   [YDBRD-12912 : SQL*LOADER支持分布式列表LOB设计](#ydbrd-12912--sqlloader支持分布式列表lob设计)  

  [YDBRD-12912](https://jira.yasdb.com/browse/YDBRD-12912)  

##   [1. Overview（概述）](#1-overview概述)  

SQL*LOADER已支持单机列表LOB导入，目前需要支持分布式列表导入，客户端支持

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 LOBFILE用法](#21-lobfile用法)  

(１) 语法描述

**说明**  ：支持全LOB导入，为动态LOB文件，涉及语法为TABLE_CLAUSE阶段。

- FILLER: 需要构造表中不存在的伪列，[ext_fname FILLER]，通过FILLER关键词表示，可出现column clause的不同位置，可被不同列引用，但不可重复声明同一filler；伪列可与表中列同名，但此时表中列不可被声明。且该伪列可不被引用。伪列不可用于condition的比较，报错处理。
- LOBFILE: 对于要导入的LOB列，[LOBCOL LOBFILE(ext_fname)]，用于将ext_fname中对应的lob文件导入lob列中。由于sqluldr2导出的csv文件路径是相对路径，默认补全在infile的目录下。


支持LOBFILE后存在terminated by eof子句，仅语法兼容且不支持别的关键字。

对于NULLIF子句，如果等号左边是指定LOBFILE的LOB列，如果是equal，恒为false；如果是not equal，恒为true。

```
LOAD DATA
INFILE 'sample.dat'
   INTO TABLE person_table
   FIELDS TERMINATED BY ','
   (name      CHAR(20),
    ext_fname    FILLER CHAR(40),
    "RESUME"    LOBFILE(ext_fname) TERMINATED BY EOF)
 
 
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

主要流程，直连dn情况与单机相同不做赘述。

直连cn情况，需要通过cn去查找dn节点，再通过dn节点进行导入操作。

其中tempLob的释放也需要注意需要根据对应dn节点的conn去释放

![](https://conf.yasdb.com/download/attachments/112724398/filler_column.GIF?version=1&modificationDate=1687677569000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1NTQsImV4cCI6MTc4MjMwMDM1NH0.tsIf3RXTn3Ytat8RyuJrp6P9prwgbPmozIpt3T6opQA)

![](https://conf.yasdb.com/download/attachments/112724398/lob_column.GIF?version=1&modificationDate=1687677569000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1NTQsImV4cCI6MTc4MjMwMDM1NH0.tsIf3RXTn3Ytat8RyuJrp6P9prwgbPmozIpt3T6opQA)

![](https://conf.yasdb.com/download/attachments/112724398/image2023-5-19_17-14-29.png?version=1&modificationDate=1687677569000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyODk1NTQsImV4cCI6MTc4MjMwMDM1NH0.tsIf3RXTn3Ytat8RyuJrp6P9prwgbPmozIpt3T6opQA)

参考资料：

-   [YDBRD-14587：SQL*LOADER支持单机列表LOB设计文档](112724398.html)  


## Attachments:

[filler_column.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGM4OTcwYzJhZjRmNTFmZmFkIiwicmVmX2lkIjoiNjczOTZhZGM3MjgyMDZlZmI5MmVmZWVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTU0LCJleHAiOjE3ODIzNzU5NTR9.cv2VkhVODTsMe2taL002_uS3eGreBRtZBKFm5wiMnJw)

 (image/gif)    


[lob_column.GIF](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGNhMWFkOWEzMzExZGM3ZTI0IiwicmVmX2lkIjoiNjczOTZhZGM3MjgyMDZlZmI5MmVmZWVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTU0LCJleHAiOjE3ODIzNzU5NTR9.pSBuhxgf2NQDZV0jm4JNvO12UlUBG0fgeJLK4QX7ezI)

 (image/gif)    


[image2023-5-19_17-14-29.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZGM4OTcwYzJhZjRmNTFmZmFlIiwicmVmX2lkIjoiNjczOTZhZGM3MjgyMDZlZmI5MmVmZWVmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjg5NTU0LCJleHAiOjE3ODIzNzU5NTR9.xd75KOpdjNN7ALKOZwvzRdTuGIV9ROHtanWMz1DUexA)

 (image/png)    
