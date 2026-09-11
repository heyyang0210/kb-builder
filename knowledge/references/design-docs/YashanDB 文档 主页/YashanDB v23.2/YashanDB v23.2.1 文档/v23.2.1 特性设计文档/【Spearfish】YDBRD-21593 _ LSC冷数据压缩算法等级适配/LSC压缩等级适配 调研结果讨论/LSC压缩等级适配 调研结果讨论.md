Created by 黄文早, last modified on 十二月 14, 2023

#   [YDBRD-21593: LSC压缩等级适配调研结果讨论](#ydbrd-21593-lsc压缩等级适配调研结果讨论)  

  [https://jira.yasdb.com/browse/YDBRD-21593](https://jira.yasdb.com/browse/YDBRD-21593)  

##   [1. Overview（概述）](#1-overview概述)  

本文主要介绍了一些行列存数据库，提供压缩算法的方式，以及提供压缩算法的类型，并展示了一些主流压缩算法，在tpch lineitem 表下的压缩表现

##   [2. Features（功能特性）](#2-features功能特性)  

###   [2.1 主流数据库压缩方式](#21-主流数据库压缩方式)  

​		下表主要列举了一些主流数据库为客户提供的压缩类型，和配置压缩类型的方式。

**Oracle HCC**

可指定表级压缩方式，无指定压缩算法，支持用户定义数据使用场景，和压缩级别

```
CREATE TABLE xxx (xxx) COLUMN STORE COMPRESS FOR QUERY/ARCHIVE LOW/HIGH;

```

**ClickHouse**

​		可指定列级别的编码。支持LZ4，LZ4HC(1  12)，ZSTD(1  22)，DEFLATE_QPL多种压缩算法，DEFLATE_QPL 使用的是intel Qpl库 ，使用与zlib相同的压缩算法，intel 库对该算法有指令级优化。

**Gauss DB**

​		不允许指定压缩算法，但是可以指定LOW，MIDDLE，HIGH 三种压缩等级，每种压缩等级支持0~4，共5中小等级。

**MariaDB**

​		对于lob 和char等长度较大类型，支持使用zlib列级别压缩，zlib 可指定    `column_compression_zlib_level`    参数设置压缩等级，支持数据库级别的压缩，用户通过插件使用BZIP2，LZMA，LZ4，LZO，Snappy 进行压缩。

**Hbase **

​		支持Brotli，BZip，GZ，LZ4，LZMA，LZO，Snappy，ZSTD多种压缩算法，做列级别压缩，对于可以指定等级的压缩算法，可以指定等级，并给出不同场景使用压缩算法的建议。

​		大多数场景，LZ4和Snappy 是比较好的选择，这两种压缩算法，压缩速度快，并且有着不错的压缩效果，是通过增加cpu 时间，减少io 时间的较好解决方案。

​		对于冷数据，如果是二进制文件，建议使用比较高等级的ZSTD，或者LZMA，如果是字符为主要内容，并且数据重复度较高的列，建议使用Brotli 。

​		对于热数据，建议可以选择LZ4，Snappy，LZO，或者较低等级的ZSTD。

**StarRocks**

​		支持使用zlib，ZSTD，LZ4，Snappy进行压缩，只支持表级别的压缩算法，文档中说明 压缩率 zlib > Zstandard > LZ4 > Snappy，zlib 可以提供很好的压缩效果，但是对查询和导入的影响比较大，存储空间没有特别的要求的用户使用LZ4和ZSTD 压缩

**databend**

​		支持LZ4，Zstd和snappy表级别压缩。对于存储在本地文件系统的数据，默认压缩算法为LZ4，对于存储在对象存储中的数据，默认为zstd。

**AWS Redshift**

​		支持LZO和Zstd列级别压缩。

###   [2.2 数据库主流压缩算法介绍](#22-数据库主流压缩算法介绍)  

​		现在数据库主流的压缩算法主要有：LZ4、ZSTD、Snappy、zlib、LZMA、Brotli等 。其中部分算法支持动态调整压缩等级，不同的压缩等级，具有不同的压缩效果，压缩率越小，压缩速度越慢。

**LZ77**

​		LZ77是一种类似字典的编码，于1977年提出，其压缩算法可参考    [https://www.cnblogs.com/idreamo/p/9249367.html，算法主要思想是在前向缓冲区中不断寻找能够与滑动窗口中短语匹配的最长短语，其已经完成压缩的数据，就是其字典。](https://www.cnblogs.com/idreamo/p/9249367.html%EF%BC%8C%E7%AE%97%E6%B3%95%E4%B8%BB%E8%A6%81%E6%80%9D%E6%83%B3%E6%98%AF%E5%9C%A8%E5%89%8D%E5%90%91%E7%BC%93%E5%86%B2%E5%8C%BA%E4%B8%AD%E4%B8%8D%E6%96%AD%E5%AF%BB%E6%89%BE%E8%83%BD%E5%A4%9F%E4%B8%8E%E6%BB%91%E5%8A%A8%E7%AA%97%E5%8F%A3%E4%B8%AD%E7%9F%AD%E8%AF%AD%E5%8C%B9%E9%85%8D%E7%9A%84%E6%9C%80%E9%95%BF%E7%9F%AD%E8%AF%AD%EF%BC%8C%E5%85%B6%E5%B7%B2%E7%BB%8F%E5%AE%8C%E6%88%90%E5%8E%8B%E7%BC%A9%E7%9A%84%E6%95%B0%E6%8D%AE%EF%BC%8C%E5%B0%B1%E6%98%AF%E5%85%B6%E5%AD%97%E5%85%B8%E3%80%82)  

**LZ78**

​		LZ78 是一种比较纯粹的字典算法，与1978年提出，压缩时会维护一个动态的字典，最新输入的字符C，压缩分三种情况，

​		1）若字符在字典中不存在，将其加入字典，记录为（0，C）

​		2)  若已存在，找到字典和C后的字符串的最长匹配，记录为（indexInDictionary，nextChar），nextChar 为输入字符串中最长匹配后的一个字符，将这个记录作为一个新的字典项插入字典。

​		3）对于最后一个字符编码为(indexInDictionary,)

​		LZ系列算法均是有LZ77与LZ78 的变种，在这两种算法基础上做了优化。

**LZ4**

​		LZ4 是LZ77的一个变种，主要特点是快速压缩和快速解压，

**Deflate **

​		Deflate 算法将LZ77和霍夫曼编码结合，压缩效率较高，主要实现库为zlib。

**Zstd**

​		2016 年开源，基于LZ77开发的一种基于字典的压缩算法，目标场景为实时压缩，

**Snappy**

​		设计目标是在保持高压缩和解压缩速度的同时，提供合理的压缩比，不支持配置压缩等级。

**LZ4**

​		基于LZ77，注重于解压速度，支持不同等级的压缩等级，压缩等级不影响解压速度。兼容于字典压缩，可以多个文件公用相同字典压缩。压缩时通过hash，将4字节保存在hash表中，以此减小字符串匹配时间。

**LZMA**

​		在LZ77基础上加入基于比特流和马尔科夫随机过程，消除原始文件中基于上下文的冗余，并通过动态规划进行字典字符串匹配。

###   [2.3 压缩算法测试](#23-压缩算法测试)  

**测试环境**

Intel(R) Xeon(R) Gold 6338 CPU @ 2.00GHz 32G内存

测试数据：1G tpch lineitem 表，未压缩生成的slice 文件

编译器版本:  GCC 7.3.1 20180303 (Red Hat 7.3.1-5)

测试方法：     [https://github.com/inikep/lzbench.git](https://github.com/inikep/lzbench.git)     工具本地编译测试。

|压缩算法（level）|compress(MB/s)|decompress(MB/s)|compresssed /unconpressed|
|---|---|---|---|
|memcpy|5876|6233|100|
|lz4 1.9.3|580|2312|46.14|
|lz4fast 1.9.3 -1|583|2312|46.14|
|lz4fast 1.9.3 -10|647|2277|49|
|lz4fast 1.9.3 -20|700|2197|51.43|
|lz4fast 1.9.3 -30|766|2490|53.78|
|lz4fast 1.9.3 -40|786|2428|54.4|
|lz4fast 1.9.3 -50|840|2619|56.13|
|lz4fast 1.9.3 -60|876|2687|56.72|
|lz4fast 1.9.3 -70|913|2761|57.9|
|lz4fast 1.9.3 -80|917|2760|57.96|
|lz4fast 1.9.3 -90|959|2860|59.19|
|lz4fast 1.9.3 -99|988|2891|59.58|
|lz4hc 1.9.3 -1|102|2369|39.92|
|lz4hc 1.9.3 -4|63.3|2383|37.3|
|lz4hc 1.9.3 -7|21.3|2468|33.94|
|lz4hc 1.9.3 -10|8.92|2642|33.04|
|lz4hc 1.9.3 -12|1.98|2736|31.98|
|zstd 1.5.5 -1|312|890|27.68|
|zstd 1.5.5 -6|66.2|782|26.01|
|zstd 1.5.5 -11|19.1|837|23.95|
|zstd 1.5.5 -16|3.25|967|22.16|
|zstd 1.5.5 -22|1.49|782|20.61|
|zstd_fast 1.5.5 --5|373|1017|37.37|
|zstd_fast 1.5.5 --4|365|988|37.91|
|zstd_fast 1.5.5 --3|347|928|39.83|
|zstd_fast 1.5.5 --2|339|1000|35.33|
|zstd_fast 1.5.5 --1|332|983|33.42|
|snappy 2020-07-11|418|1188|43.04|
|lzma 19.00 -0|25.8|62.3|21.37|
|lzma 19.00 -5|1.81|86.4|18.22|
|lzma 19.00 -9|1.26|85.0|17.92|
|brotli 1.0.9 -0|330|263|30.95|
|brotli 1.0.9 -3|101|295|28.2|
|brotli 1.0.9 -6|23.1|360|23.56|
|brotli 1.0.9 -9|6.94|406|22.23|
|brotli 1.0.9 -11|0.48|304|19.1|
|zlib 1.2.11 -1|71.2|279|29.11|
|zlib 1.2.11 -4|45.4|290|26.93|
|zlib 1.2.11 -7|11.7|310|25.43|
|zlib 1.2.11 -9|2.68|306|25.29|


​		由表中可以看出，LZ4与Zstd的解压速度最快，LZ4相比于Zstd，在相同压缩速度下，LZ4压缩比低于Zstd，但是解压速度LZ4高于Zstd。LZMA 在近的压缩速度下，压缩率高于Zstd ，但是解压速度低于Zstd。Snappy 压缩与解压速度都比较块，但是压缩比较低，相较于LZ4 默认压缩，LZ4压缩速度解压速度均快于Snappy，只是LZ4压缩比略微低于Snappy。Brotli 与Zlib 近似压缩比下，相较于Zstd 压缩速度和解压速度均没有优势。

###   [2.4 总结](#24-总结)  

​		目前的压缩算法，基本都是基于字典，去除文件内的冗余内容，只是不同压缩算法的侧重点不同，导致不同的压缩算法适用于不同的场景。

|写入性能|读取性能|压缩比|推荐压缩算法|
|---|---|---|---|
|高|高|低|LZ4 /Zstd|
|高|中|高|Zstd|
|低|高|高|高等级LZ4/Zstd|


​		目前lsc 冷数据支持LZ4与Zstd压缩，但是支持压缩等级并未实现，需要考虑实现；从压缩率上看，LZMA有优于Zstd 的压缩效果，可以考虑支持；有些数据库，压缩是列级别的，不同的列可能有不同的访问频率，可以考虑实现，列级别指定压缩算法。

|编码类型|编码等级|实际编码等级|压缩率|压缩速度|解压速度|
|---|---|---|---|---|---|
|LZ4|低|lz4 default|46.14|580|2312|
|LZ4|中|LZ4HC|39.92|102|2369|
|LZ4|高|lz4HC -4|37.3|63.3|2383|
|ZSTD|低|1|27.68|312|890|
|ZSTD|中|4|26.42|179|764|
|ZSTD|高|7|25.59|55.2|806|
|LZMA|ALL|0|21.37|25.8|62.3|


![](https://pingcode.yasdb.com/atlas/files/public/67396c64a1ad9a3311dc8a42/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUlBQUFBQWdBQUFBSUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA1OTEsImV4cCI6MTc4MjMxMTM5MX0.3QV_u6BT4GQtu6mJmB6CCE-6QXu6EIKLrQP7mKui-KU)

## Attachments:

## Comments:

|  [](null)  ,性能曲线，推荐用户不同场景使用,Posted by huangwenzao at 十月 23, 2023 14:56|
|---|
|  [](null)  ,需要标记level，提供数字，共内部调整,Posted by huangwenzao at 十月 23, 2023 14:58|
|  [](null)  ,列压缩等级，若未指定压缩算法，沿用表压缩算法,Posted by huangwenzao at 十月 23, 2023 15:05|
|  [](null)  ,LZMA 有实现价值，但优先级比较低,Posted by huangwenzao at 十月 23, 2023 15:10|
|  [](null)  ,指定列压缩类型已实现，指定压缩等级未实现,Posted by huangwenzao at 十月 25, 2023 09:05|
