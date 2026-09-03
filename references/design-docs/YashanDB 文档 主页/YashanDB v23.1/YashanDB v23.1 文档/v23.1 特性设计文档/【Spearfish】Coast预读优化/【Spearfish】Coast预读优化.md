Created by 谢锐, last modified on 六月 02, 2023

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#1-overview概述)  

*说明本设计方案的背景、需求。*

*coast格式预期生成的extent大小为1MB，但是经过压缩后大小可能才几十到几百KB，这样读取的性能仍然不够理想，尤其是使用对象存储的场景下。*

*另外大查询下cache的效果难以预测，原基于queryDigest的优化在并发下效果存在不确定性。(二次查询劣化现象)*

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#2-features功能特性)  

*说明本方案的功能特性。*

*1，支持配置使用LSC Data buffer的最大记录数*    


*     执行计划给出评估的查询记录数量，如果表记录数超过配置，则其读取的数据不会放入lsc data buffer。避免淘汰其他对象。*

*2，支持合并读优化*

*      完善视图sysstat，增加压缩，解压缩字节数统计*

*3,  优化参数SCOL_DATA_PRELOADERS,上限提升到256线程。*

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#3-interfaces接口)  

*列出本方案对外提供的接口、配置参数、API等。*

*配置项 *

*1，SCOL_CACHEABLE_SCAN_ROWS*

*     默认值0xFFFFFFFFFFFFFFFF, 所有查询都使用。*    


##   [4. Limitations（功能限制）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#4-limitations功能限制)  

*说明本方案对外的功能限制或约束。*

  


*合并对象的数量最多32个，最大合并pack为4M。*

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#5-detail-design详细设计)  

*方案设计的详细说明，包括但不限于方案选型、方案所依赖的技术/第三方组件的原理或背景介绍、关键技术点、方案折衷的考量、可靠性分析、兼容性分析。可以根据需要增删小节。*

###   [5.1 Architecture（架构）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#51-architecture架构)  

*说明方案的总体架构，优先考虑通过架构图进行描述。*

  


针对上述功能要求，架构上需要做一些调整：

1，objectCache并非必选项,，大查询可以跳过。

2，连续读请求在IO路径上合并

  


![](https://pingcode.yasdb.com/atlas/files/public/67396af58970c2af4f520035/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUVBQUFBQUJnQUFBQUFBQUFBQUJBQUFBQUFBQUlBQUVBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyOTEsImV4cCI6MTc4MjMwMTA5MX0.LaGwVaLzEITgLdkZSVOlms1ZMKhPX8jkWKYCabpQ6wg)

该方案下IO不再经过ObjectCache，统一由PackReader完成。

读取时PackReader首先检查对象是否在objectCache中，如果在，则直接Pin住。

PackReader使用完后，如语句启用cache且对象原不在cache中，则将对象放入objectCache。

                                   如对象本来自cache，则unpin即可。

PackReader在xM范围内尽可能做合并读。

  


优点：

1，不管扫描的数据是否存入cache，如对象已在cache中都可以使用。

2，是否使用合并读与是否使用cache解耦。

  


缺点：

1，不论是元数据对象，还是column extent对象都可能出现重复读。

     元数据大概率缓存，因而仅首次可能出现，extent重复读概率较低。

  


注意由于Metadata是尽可能缓存的方案，因而meta目前维持还来的路径。

StarRock/CK方案均类似于此。

  


### 备选方案1

##   

![](https://pingcode.yasdb.com/atlas/files/public/67396af58970c2af4f520036/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUVBQUFBQUJnQUFBQUFBQUFBQUJBQUFBQUFBQUlBQUVBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyOTEsImV4cCI6MTc4MjMwMTA5MX0.LaGwVaLzEITgLdkZSVOlms1ZMKhPX8jkWKYCabpQ6wg)

  


PackReader作为ObjectCache的替代。

PackReader被当前ColumnReader和Preloader共享，支持多个对象合并读，其加载的对象一次性使用。

查询如果使用cache，则继续走objectCache，否则走PackReader。预期效果是小查询以及元数据读取走objectCache, 大查询走PackReader。

  


优点：对当前代码改动最小，风险低

缺点：增加了耦合，即查询的大小与是否合并读相关联。

  


### 备选方案2

在当前方案上支持合并读，IO继续走objectCache，处理多个对象的并发问题。

但存在问题： 多对象并发时等待机制，如加载多个对象，但其中一个对象处于loading，当前读取是否等待？

此外该方案对objectCache侵入性更大。

###   [5.2 Data Structures & Flow（数据结构与流程）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#52-data-structures--flow数据结构与流程)  

*设计主要数据结构、工作流程、序列图等。*

  


##   

![](https://pingcode.yasdb.com/atlas/files/public/67396af58970c2af4f520037/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUVBQUFBQUJnQUFBQUFBQUFBQUJBQUFBQUFBQUlBQUVBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQVFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTAyOTEsImV4cCI6MTc4MjMwMTA5MX0.LaGwVaLzEITgLdkZSVOlms1ZMKhPX8jkWKYCabpQ6wg)

  


*Pack：根据过滤的bitmap，以及pack大小以及对象数量限制，将列需要读取的extent打包成pack。*    


*PackReader：管理pack读取状态，以及内容。支持column reader和preloader的并发控制。*

  


*PackReader*  中对象结构为：

MemObject + CosDataObject + objectContext

  


内存管理：

objectCache接口的读取，上述内存结构内存是连续的。

在多对象读的情况下，如果未开启压缩，则使用单对象读取。如开启压缩，则在load对象时分配连续内存。

*PackReader*  使用LSC Data Buffer内存。

  


###   [5.3 Compatibility（兼容性）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#53-compatibility兼容性)  

*说明设计方案对兼容性的影响，如果影响了兼容性，则需要给出详细的兼容性方案设计*

  


不涉及

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

  


*1，合并可通过io次数来观察*

*2，cache使用可以通过cache命中率*

  


自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


##   [7. Document（资料）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#7-document资料)  

  


|  
|ClickHouse|StarRocks|YashanDB/LSC|
|---|---|---|---|
|预读技术|无，单独io pipeline|无，单独io pipeline|有preloader|
|合并读|ck支持range的delay读能力，当io连续时推迟io实际下发的时机达到合并读的效果|StarRock在存储结构segment和page之间，有一个逻辑上的chunk概念，io是以chunk为单位的(代码分析，无官方材料)|pack reader，目前extent这层变得可有可无了，好处是压缩效果。坏处是io放大。或者说yashandb extent才是对标其他产品page的。|
|内存缓存|page cache，支持大查询跳过|page cache|lsc data buffer，元数据与数据合用|
|磁盘缓存|diskcache|block cache仅给external storage使用|diskcache，支持与内存联动|


  


##   [8. Workload（工作量）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#8-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [9. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=85101386#9-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

[coast2-Page-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjRhMWFkOWEzMzExZGM3ZWE2IiwicmVmX2lkIjoiNjczOTZhZjQ1OTNmOTljOWZmMjM1YjkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjkxLCJleHAiOjE3ODIzNzY2OTF9.oWih7wywmBnG7KjYr29hlNGG8JGisXjE8iyzLVS9se8)

 (image/png)    


[coast2-Page-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjQ4OTcwYzJhZjRmNTIwMDJlIiwicmVmX2lkIjoiNjczOTZhZjQ1OTNmOTljOWZmMjM1YjkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjkxLCJleHAiOjE3ODIzNzY2OTF9.szTUJHexKWQU7Ql5VOwGKDZFAdo3R1fXywshKbhmV8E)

 (image/png)    


[coast2-Page-6.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjVhMWFkOWEzMzExZGM3ZWE5IiwicmVmX2lkIjoiNjczOTZhZjQ1OTNmOTljOWZmMjM1YjkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjkxLCJleHAiOjE3ODIzNzY2OTF9.vpJZ5KwfaLTjxzRp-LO4mnMcjYGxt9Fk6lq9ITRe65k)

 (image/png)    


[coast2-Page-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjU4OTcwYzJhZjRmNTIwMDMwIiwicmVmX2lkIjoiNjczOTZhZjQ1OTNmOTljOWZmMjM1YjkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjkxLCJleHAiOjE3ODIzNzY2OTF9.J91Hekst9xrIKpCPq7VzC5dk6y_EZq2tqbJh36Lt2SE)

 (image/png)    


[coast2-Page-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjVhMWFkOWEzMzExZGM3ZWFhIiwicmVmX2lkIjoiNjczOTZhZjQ1OTNmOTljOWZmMjM1YjkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjkxLCJleHAiOjE3ODIzNzY2OTF9.eruppr4MNRVVGgoQBhWnUXg-O5yNP9I_YPsrF_Ruvww)

 (image/png)    


[coast2-Page-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZhZjVhMWFkOWEzMzExZGM3ZWFiIiwicmVmX2lkIjoiNjczOTZhZjQ1OTNmOTljOWZmMjM1YjkwIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkwMjkxLCJleHAiOjE3ODIzNzY2OTF9.mRc8-kFtcyyR0gTc7KT2_DUOh84ZOxsqJILiKasqcY4)

 (image/png)    


## Comments:

|  [](null)  ,大查询不使用cache，一方面cache效果不好，另外bypass cache后并发下内存分配的竞争会降低。,每个并发线程可以使用私有分配器，不必从lsc data buffer分配。由于都是大块内存分配这里对并发性能影响很大。,tpch1T下测试性能可提升1倍多。,Posted by xierui at 六月 01, 2023 10:44|
|---|
