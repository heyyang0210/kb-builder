Created by 朱月婷, last modified by  吴水海 on 八月 10, 2023

  


#   [YDBRD-14164: SQL LOADER OUTLINE_LOB (STAND-ALONE HEAP) DESIGN](#ydbrd-14164-sql-loader-outline-lob-stand-alone-heap-design)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-14164](https://jira.yasdb.com/browse/YDBRD-14164)  

##   [1. Overview（概述）](#1-overview概述)  

在此之前SQL LOADER已支持INLINE形式的LOB，对于OUT_LINE的LOB需要单独支持语法和执行，即该SR。

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

filename.ext   是包含LOB的文件的名称。nnn  是文件中LOB的字节的偏移。该偏移大于lob文件大小则报错。该值小于0报错，0和1结果一致。oracle中lob数据文件大小为0时也报相同的错误，我们与oracle保持一致。mmm  是字节中的LOB的长度。值为-1，0表示LOB为null。该值小于-1就报错。正斜杠（/) 为终止字符，必须要有，有多余4个   .     的时候，不读  第四个   .    以后的数据，但仍需正斜杠(/)nnn+mmm大于lob文件大小时，从偏移位置一直导入至文件末尾。

##   [3. Detail Design（详细设计）](#3-detail-design详细设计)  

###   [3.1 LOBFILE](#31-lobfile)  

####   [1.服务端](#1服务端)  

parse阶段：新增参数FILLER及LOBFILE子句。

verify阶段：

- 1.验证存在LOBFILE关键词的是否为LOB列；LOBFILE指向的伪列是否存在。
- 2.对于condition子句左边为lob列的情况，统一返回false。


exec阶段：

- 1.对于未指定LOBFILE的列，直接调用anlKernelRowPut，与之前行为一致；
- 2.对于指定LOBFILE的列，需要压出一个32K或64K的内存，用于将lobfile中的数据分批读进来，调用lobAppend；


注：需要tempLobCoupon记到partBlock的尾部，用于vm的free，进行页面管理，当首尾间的freeSize小于63k时，触发一次insert。

对于heap表，在进行rowPut之后就可以free；列表需要在调用colBuilderPut后在进行free。该SR支持的LOBFILE等功能同时支持列表，但对于列表是语法及功能兼容，实际还是仅支持INLINE的LOB。

####   [2.客户端](#2客户端)  

parse阶段：同服务端

verify阶段：同服务端

exec阶段：申请YacLobLocator，createTempLob，yacLobWrite，触发发送条件，发送至服务端进行insert。

###   [3.2 LLS](#32-lls)  

loadTryParseLLS(LoadParser* parser, LangWord* word, LoadColumnDef* columnDef)    
  verifyLoadLLS(AnlVerifier* vrfr, LoadTableDef* tableDef)    
  执行接口待完善    
  prepareLoadData(AnlStmt* stmt, LoadTableCache* cache, CsvCursor* csvCursor,LoadTableDef* tableDef, LoadInsertStatus* currLineStatus)

##   [4.Specification And Constraints（规格与约束）](#4specification-and-constraints规格与约束)  

inline LOB最大为32000(不包括LOB头长度)    
  如果满足以下任何条件，则报告错误并拒绝该行：

- 找不到文件，偏移量无效（偏移量大于文件大小），关于偏移量和size大小可以看文章末尾的例子，目前我们不做偏移量+size大小大于文件大小的警告，选择直接导入数据至文件末。
- 该字段的内容与预期的格式不匹配。
- 与LLS字段关联的列的数据类型不是CLOB，BLOB或NCLOB。


目前linux支持绝对路径和相对路径，window只支持绝对路径。

![](https://pingcode.yasdb.com/atlas/files/public/67396ae88970c2af4f51ffdb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBREFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkJBQUFBQUFBQUFBQUFDQUFBQUFBQUVBQUlBQWhBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFJRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAwMTMsImV4cCI6MTc4MjMwMDgxM30.Agc78QFcSCUtWmLFzmvP8SWufFsMqNbJY4Gq4PLWIbc)

![](https://pingcode.yasdb.com/atlas/files/public/67396ae8a1ad9a3311dc7e51/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBREFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkJBQUFBQUFBQUFBQUFDQUFBQUFBQUVBQUlBQWhBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFJRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAwMTMsImV4cCI6MTc4MjMwMDgxM30.Agc78QFcSCUtWmLFzmvP8SWufFsMqNbJY4Gq4PLWIbc)

![](https://pingcode.yasdb.com/atlas/files/public/67396ae88970c2af4f51ffdc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQVFBQUFBQUFBQUFBQUFBREFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkJBQUFBQUFBQUFBQUFDQUFBQUFBQUVBQUlBQWhBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUFBQUFJRUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAwMTMsImV4cCI6MTc4MjMwMDgxM30.Agc78QFcSCUtWmLFzmvP8SWufFsMqNbJY4Gq4PLWIbc)

## Attachments: