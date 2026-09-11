IR链接：  [https://pingcode.yasdb.com/ship/ideas/66cc7c1d4283cf23d4f3c3c6?](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b016?)  

##   [1. 总述](#1-总述)  

###   [1.1 需求来源](#11-需求来源)  

条带化（Striping）是一种数据存储技术，主要用于提高存储系统的性能。它通过将数据分割成多个小块，并将这些小块分布到不同的磁盘或存储单元上，以并行方式进行读写操作，从而提高存储系统的吞吐量和性能。

YFS通过条带化技术，可以提供IO负载均衡能力，尤其是并发读写数据块场景的IO吞吐有显著的提升。

###   [1.2 调研文档](#12-调研文档)  

  [YFS条带化产品行为定义](https://pingcode.yasdb.com/wiki/spaces/PRODUCT/pages/67389b59728206efb925c94b)  

  [调研报告-YDBRD-33400：YFS 支持条带化调研报告](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/6739760e593f99c9ff23c151)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|SR|
|---|---|---|---|---|---|
|功能|支持粗粒度条带化|循环从不同disk上分配AU，每个AU不作进一步切分。|是|是|  [https://pingcode.yasdb.com/pjm/items/670498a3e489dd0868f1776b?](https://pingcode.yasdb.com/pjm/items/670498a3e489dd0868f1776b?)  ,#YDBRD-33400 YFS支持AU粒度条带化|
|功能|支持细粒度条带化 |一次从多个disk上分配多个AU，然后,将AU水平切分为若干条带，统一水平线上的切片在文件内逻辑上连续。|是|否|NA|
|性能|顺序IO|物理上连续对顺序IO更加友好，因此对于顺序IO的文件默认不开启条带化，例如redo文件。|否|是|NA|
||离散IO|条带化不会影响单线程的离散IO性能，但是是提升并发离散IO的整体吞吐，因此对于离散IO的文件默认开启条带化，例如数据文件。|否|是|NA|
|兼容性|历史版本兼容|历史版本已经创建好的文件不支持条带化，不存在兼容性问题|否|是|NA|


###   [1.4 数据字典](#14-数据字典)  

|术语|描述|借鉴业界|参考|
|---|---|---|---|
|条带化|将数据分割成多个小块，并将这些小块分布到不同的磁盘或存储单元上，以并行方式进行读写操作|是|NA|
|顺序IO|逻辑上连续读取文件|是|NA|
|离散IO|逻辑上随机读取文件的任意位置|是|NA|


###   [1.5 开源依赖](#15-开源依赖)  

NA

##   [2. 接口](#2-接口)  

|接口|接口表现|接口说明|
|---|---|---|
|系统参数|DATA_STRIPING|db数据文件是否条带化开关|
|系统参数|REDO_STRIPING|db redo，archieve文件是否条带化开关|


##   [3. 规格与约束](#3-规格与约束)  

细粒度条带化主要用于ctrl文件等单次IO大小很小的场景，但是目前YashanDB的ctrl文件读写是串行的，因此细粒度条带的实际价值很小，本次特性只支持粗粒度的条带化，用于数据文件并发读写的IO负载均衡。

##   [4. 特性](#4-特性)  

###   [4.1 文件空间分配](#41-特性功能点1)  

将文件最后一个extent的磁盘的下一个磁盘作为本次申请的起始disk，然后循环进行分配

![image.png](https://pingcode.yasdb.com/atlas/files/public/67a70dd898ac295b69be0ba6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQVFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTcwMDksImV4cCI6MTc4MjQ2NzgwOX0.ZP9PdZPnGiOjkGmV11xZj5jD1A8lppkz83aGrsO437I)

这样从FAT的角度，单个文件的extent会被分散到不同的disk上，但有并发随机IO时，IO也会被分散到不同的disk上。

##   [5.未来规划](#5未来规划)  

支持细粒度条带能力

