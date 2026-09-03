Created by 陈晓晴, last modified on 七月 14, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#1-overview概述)  

在单机部署的情况下，JDBC驱动对clob、blob类型数据实现了一系列操作数据的接口，以便于jdbc客户端对数据库进行clob、blob数据的插入、读取、更新等功能。目前，操作表中持久化的lob数据的api对列表的lob数据仍然不支持，本方案主要详细介绍本次支持操作列表的lob数据所涉及的api以及其实现所需修改的逻辑范围。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#2-features功能特性)  

支持单机部署情况下所有LOB API对列表的lob操作。

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#2-features功能特性)  

需要支持的相关api为：

![](https://pingcode.yasdb.com/atlas/files/public/67396b2da1ad9a3311dc80d2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTE1MzUsImV4cCI6MTc4MjMwMjMzNX0.P-_LAhxMYcyqQIctHM_FrswmkzLWVtnbsbRaoMrerak)

  


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#4-limitations功能限制)  

无。

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=76913813#5-detail-design详细设计)  

### 1.  存储阶段

### (1) 列格式LOB新增flag区分temp lob inrow 与knl lob inrow。

由于列格式的lob在列存与列执行中都有使用，因此需要在ColumnarLobHead中新增标志位，区分列执行生成的inrow lob与列存透传的inrow lob。

### (2) 查询加锁场景为inrow lob生成正确的locator。

背景：目前select for uddate场景，为inrow生成locator的逻辑由执行层统一执行，对于inrow的数据，就无法获取其所在的列的id信息。行表有通过locator进行扫描获取inrow 数据的columnId信息（通过对比lobId），列表没有。

适配：在存储底层，查询加锁成功后，识别dataset中得到的扫描结果包含的inrow lob的数据，在数据后面加上locator信息。

### (3) coral更新的场景支持立即插入和返回新的rowId。

由于使用api操作lob函数需要维持locator的正确性。而coral的更新（即LSC表冷数据部分的更新）会造成改数据所在的rowId改变，因此，coral的更新需要支持返回更新后数据的rowId。由于使用lob api对lob数据单独更新是使用的rowId扫描，因此coral的更新是立即插入的。

  


### 2. 执行阶段

由于与JDBC客户端对lob的操作都是使用locator的，因此在jdbc端通过不加锁的查询得到的inrow lob，也是需要返回正确的locator的。目前主干上未支持列表lob使用lob api的操作，所以现在列表的inrow lob并没有给客户端返回一个正确的locator，

本次方案需要支持发送的时候为列表的inrow lob组装正确的locator。

  


  


### 3. lob api

lob api提供通过正确的lob locator，单独操作lob数据，其中未适配的的功能只有更新，将列表更新lob的逻辑加上即可。

  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

通过api接口对tac表、lsc表热数据、冷数据操作lob。

加锁场景、不加锁场景。

更新从outline变inline、inline变outline。

等。

  


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

存储层：（1）加锁查询的场景下，inrow lob需要列存自己生成locator带在数据后面。

               （2）冷数据：更新后提供返回新的rowId的能力。

执行层： （1）区分计算生成的temp lob in row 与 列存的 knl lob in row，以便于未加锁查询的情况下，发送给客户端时为列存的 inrow lob组装locator。

lob api层： 单独提供的更新lob的api接口，是ank层接口，只包含行表更新lob的逻辑。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments:

## Comments:

|  [](null)  ,c驱动、python驱动,Posted by chenxiaoqing at 七月 13, 2023 17:42|
|---|
