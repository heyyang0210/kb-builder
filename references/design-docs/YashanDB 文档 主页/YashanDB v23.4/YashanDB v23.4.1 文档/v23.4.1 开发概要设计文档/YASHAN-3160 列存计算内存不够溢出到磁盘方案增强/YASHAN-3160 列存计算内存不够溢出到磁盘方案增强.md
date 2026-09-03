##   [1. 总述](#1-%E6%80%BB%E8%BF%B0)  

    [https://pingcode.yasdb.com/ship/ideas/66c83d144283cf23d4f3ab48](https://pingcode.yasdb.com/ship/ideas/66c83d144283cf23d4f3ab48)      ?#YASHAN-3160  列存计算内存不够溢出到磁盘方案增强

###   [1.1 需求来源](#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求来源于内部逻辑优化。 当前向量化执行引擎在执行Hash join时，如果碰到构建build表内存不足时，会采用分批的方式执行，当前的实现存在两个问题，当build表重复记录比较多时，分批无法减少内存的使用。此时hash table和数据都是存在硬盘上的，当前没有充分利用现有内存进行计算，会导致此种模式性能比较差。另外一种情况就是当内存非常小时，分批太多。会导致Probe表也要分很多批次。由于Probe表一般都是大表，对其进行分批，会导致性能差非常多。当hash join进入Probe阶段之后，即使系统中有内存Hash join也不会变快的。

**需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分行存和列存。**

###   [1.2 调研文档](#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**概述**     友商相似需求的实现情况，详细调研在在调研文档中展开，要体现调研要素的全面，由另一个文档阐述。为了避免头重脚轻，调研不用在本文档展开。

###   [1.3 需求分析](#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

功能列表

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|性能|需要解决build table重复值比较多时hash join性能慢的问题|||||
|性能|需要解决hash join分批比较多时，后续内存变大性能加速不明显的问题|||||


###   [1.4 数据字典](#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|


###   [1.5 开源依赖](#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|---|---|---|---|


##   [3. 规格与约束](#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**说明从IR层级对外的功能规格或约束。结合《特性调研文档》，给出我们与竞品的差异点、优缺点描述。**    规格要参考商业数据库，由SE给出，由产品评审。约束需要SE/MDE确定方案给出。

- 1）hash join开始获得的内存比较小时，后面可获得的内存增加比较明显时（例如10倍），可以看到性能有明显的提升。当前版本也做过内存提升的。
- 2）hash join重复值比较多时，hash join性能会有30%以上的性能提升。
- 3）当hash join所获得的内存确实比实际要求的内存小非常多时，本方案无法保证有优化效果。


##   [4. 特性](#4-%E7%89%B9%E6%80%A7)  

![](https://pingcode.yasdb.com/atlas/files/public/6739714e8970c2af4f522be0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQWdBQUFBQUFBQUVCQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBRUFJQUFFQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4MDgsImV4cCI6MTc4MjQ2NzYwOH0.i8DKRduexCsceGci9BMQjEY-U4hVo4LFxbFhChaiIfs)

 要解决hash join重复值比较多时性能慢的问题和hash join由于分批太多导致内存增加也无法加速的问题。目前准备采用的方案是引入一种LRU cache的机制。hash table尽量用内存来存储。数据部分采用LRU cache来存储。Hash table中的结构目前都是定长数据， 批量数据目前是变长数据。针对这两种数据的LRU算法会有所不同，主要是内存的计算方式和淘汰的策略。

![](https://pingcode.yasdb.com/atlas/files/public/6739714ea1ad9a3311dcaa51/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQWdBQUFBQUFBQUVCQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBRUFJQUFFQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4MDgsImV4cCI6MTc4MjQ2NzYwOH0.i8DKRduexCsceGci9BMQjEY-U4hVo4LFxbFhChaiIfs)

新增加的Lru cache 设计

![](https://pingcode.yasdb.com/atlas/files/public/6739714e8970c2af4f522be1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQWdBQUFBQUFBQUVCQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBRUFJQUFFQUFBQUFBQVFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTY4MDgsImV4cCI6MTc4MjQ2NzYwOH0.i8DKRduexCsceGci9BMQjEY-U4hVo4LFxbFhChaiIfs)

###   [4.1 重复值比较多时性能优化](#41-%E9%87%8D%E5%A4%8D%E5%80%BC%E6%AF%94%E8%BE%83%E5%A4%9A%E6%97%B6%E6%80%A7%E8%83%BD%E4%BC%98%E5%8C%96)  

当前hash join的hash table数组来存储。当重复值比较多时，hash table占用内存比较大的主要是数据组占用的内存。另外builder表的数据是按照批数据进行存储的。正常情况下，占用内存比较多的主要是hash table和builder表的批量数据。当重复值比较多场景，通过分批方式最多只能把每个批次的值降低为1，此时批量数据占用的内存还是比较大的。当前的方案是hash table和数据都采用文件来存储。没有充分使用内存。

###   [4.2 解决分批大时，性能慢的问题](#42-%E8%A7%A3%E5%86%B3%E5%88%86%E6%89%B9%E5%A4%A7%E6%97%B6%E6%80%A7%E8%83%BD%E6%85%A2%E7%9A%84%E9%97%AE%E9%A2%98)  

当分批比较大时，如果Probe表比较大，性能会比较差。当hash join进入到probe 阶段时，对probe表的切分会比较耗时间。因为要写一个大表的大部分数据到磁盘中。如果采用LRU cache方案。给定一个最小内存就可以把build table构建出来。因为hash table和数据都是可以物化到磁盘的。当cache 内存不够时就会落盘。当hash join可以分配更加多的内存时。进入了probe阶段就无法加速了。导致性能比较差。采用LRU cache方式存储builder 表数据后，由于数据是有热点的当分批比较多时，builder 表数据和hash table都采用LRU cache来存储LRU cache的特点是在任何阶段，只要有充足的内存，hash table和build表就可以加载更加多的磁盘数据到内存，实现变快。这样就可以解决SQL 竞争导致开始分批内存时，由于SQL所需要的内存评估不准确。导致其初始内存比较少。执行时由于SQL 并发导致其在某段时间也无法分配到合适的内存执行。碰到这种场景时，内存不足的SQL可以定期尝试从配额分配更加多的配额来加载更加多的数据到内存计算。达到计算加速的目的。

###   [4.4 特性性能点2](#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

###   [4.5 特性可维可测设计](#45-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.6 特性安全设计](#46-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性周边配合](#47-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

**子章节的数目和1.3 需求分析中特性涉及数是对应的，除非功能点很小，在1.3的概述中几句话就能讲明白。**

##   [5.未来规划](#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

hash join获得的内存确实比较小时，切换到merge join也是一种方案，后续需要考虑。

## Attachments:

  [内存溢出.jpg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI0NTZiYTBmYWMwMWQ0NWYwYmE3ZDJkZWY0Njg3YjM5NCIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTcxNGRhMWFkOWEzMzExZGNhYTRmIiwiaWF0IjoxNzMyMTUwNDg3LCJleHAiOjE3MzIyMzY4ODd9._IfdDV2zP9vDXjoN5tjRvW0Pdp0m1j6XVMYRjZIpsLk)  

 (image/jpeg)    