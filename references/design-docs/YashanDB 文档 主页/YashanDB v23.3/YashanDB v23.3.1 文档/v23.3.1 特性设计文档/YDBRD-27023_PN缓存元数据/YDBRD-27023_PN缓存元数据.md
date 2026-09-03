Created by 梁桢灏, last modified on 十月 15, 2024

  


##   [1. 总述](#1-总述)  

当前YashanDB存算一体的分布式架构(CN&MN&DN)较为完善且可用，如果要在基础上通过引入对象存储，实现存储的弹性扩展的存算分离架构，此时的计算资源并不能做到快速的弹性伸缩，DN节点的扩容是一个相当重的操作。在各方面的权衡后，选择了引入PN作为拥有快速伸缩能力的计算类型节点。

pn节点属于计算节点，不存储数据以及同步dn元数据，数据存放在s3对象存储中，当进行查询操作时，pn将通过网络交互从dn端拉取元数据，从而实现pn端的查询功能。但在大部分ap场景下，冷数据变更是通常集中一段时间，大部分时间都是稳态不变的，因此可以缓存在pn端，以便减少元数据交互，提升性能。

  [YashanDB存算分离总体方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=119559628)    。

###   [1.1 需求来源](#11-需求来源)  

- 内部需求，由分布式需要往存算分离的方向进行架构演化而产生。
-   [存算分离技术项目立项评审纪要](https://conf.yasdb.com/pages/viewpage.action?pageId=124257774)    。
- 支持形态：分布式。


###   [1.2 调研文档](#12-调研文档)  

  [存算分离竞品调研分析](https://conf.yasdb.com/pages/viewpage.action?pageId=119558136)  

###   [1.3 需求分析](#13-需求分析)  

分布式下pn进行查询时，由于pn不存储元数据，因此元数据需要通过网络交互从dn拉取。在ap场景下，使用场景通常为导入后进行查询，或者插入到热数据区，等到指定时间才转冷数据，发生冷数据更新删除较少，因此大部分情况下元数据没有发生变更，并且元数据拉取需要网络开销，影响查询性能。根据lsc表ap的场景下，考虑可以讲元数据缓存在pn端，当需要拉取元数据时，只需要到dn校验缓存元数据，若元数据可用，则不需要从dn拉取，从而减少网络交互，提升查询性能。

##   [2. 接口](#2-接口)  

##   [3. 规格与约束](#3-规格与约束)  

##   [4. 特性](#4-特性)  

实现pn端元数据的缓存，以及元数据版本的校验，并保证数据的一致性。

实现pn端元数据的缓存引入下面模块：

1. lru_kv：由lru与kv结构组合，用于按照某个key进行查询，并支持淘汰。
1. meta cache：元数据缓存。
1. meta manifest：记录最新chunk元数据。


###   [4.1 lru_kv](#41-lru-kv)  

lru_kv由lru与kv结构组成，其中kv负责根据查询的key找寻对应缓存的内容value，而lru则负责淘汰缓存内存，以便释放内存。

lru_kv使用挂载的方式而非加载的方式，即所需要的缓存不由lru_kv调用回调进行加载，而是先加载好缓存后，外部调用接口将缓存挂载到lru_kv中。

###   [4.2 meta cache](#42-meta-cache)  

meta cache主要由lru_kv构成，利用lru_kv的能力查找版本元数据，管理元数据和淘汰元数据。meta cache目前内存来源与scol_data_buffer_size。

- 当slice缓存占用过大，meta cache占用未达配置项上限时，meta cache将调用接口淘汰部分slice缓存，以便后续缓存元数据。
- 当meta cache缓存达上限后，meta cache需要更多内存缓存元数据时，将淘汰部分meta cache内的元数据。
- 当meta cache达到上限，slice缓存同时需要更多内存时，将在slice缓存中淘汰。


总结：slice缓存可以借用部分meta cache内存，meta cache可以触发淘汰slice缓存以便归还占用内存，但slice缓存不可触发meta cache淘汰抢占meta cache内存。

目前scol_data_buffer一次分配最小128K，对于数据量少的情况下，元数据很小容易造成过大的内存浪费，因此scol_data_buffer当需要配128K以上大小的元数据内存时，直接分配，而小于128K时，分配出来的内存使用memHeap切割为小块进行管理。

目前meta cache内只缓存3类元数据：

- chunkPack
- slicePack
- dbmPackdcPack不用缓存，因为dcPack加载完dc后即可释放。


meta cache的key结构如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ec1a1ad9a3311dc9991/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUJBQUFRQUFBQUFBRWdBQUNBQUVBQUFDQUFBQWdJRUFBQUVBSUFBSVFBRUFRQUNBQUFBQUFBQUlHQUFBQUFBQUFBQUJBQUFBQUlnQUFBQUFBQUFBUUFBZ0FBQUFHQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NjAsImV4cCI6MTc4MjQ0OTY2MH0.ffUguBgJXyAQl-ufRQl-5Sj3opqZ9auSWMdgy-3w3LM)

metaStore调用meta cache流程：

1. metaStoreOpenSlice/Dbm。
1. metaStore根据要获取的元数据版本以及元数据类型，构造meta cacheKey。
1. 根据meta cacheKey调用meta cacheGetAndPin接口尝试从meta cache中找寻该元数据，若存在，则直接返回该元数据。
1. meta cache中不存在该版本元数据，metaStore调用metaAgent加载元数据。
1. metaStore调用meta cacheSetAndPin接口把元数据挂载到meta cache中，若meta cache返回元数据与挂载元数据一致，则返回加载元数据，若不一致，则该元数据被其他线程挂载到meta cache中，释放加载元数据，返回meta cache中元数据。


![](https://pingcode.yasdb.com/atlas/files/public/67396ec18970c2af4f521b1f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUJBQUFRQUFBQUFBRWdBQUNBQUVBQUFDQUFBQWdJRUFBQUVBSUFBSVFBRUFRQUNBQUFBQUFBQUlHQUFBQUFBQUFBQUJBQUFBQUlnQUFBQUFBQUFBUUFBZ0FBQUFHQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NjAsImV4cCI6MTc4MjQ0OTY2MH0.ffUguBgJXyAQl-ufRQl-5Sj3opqZ9auSWMdgy-3w3LM)

###   [4.3 meta manifest](#43-meta-manifest)  

meta manifest用于记录加载到meta cache中最新的chunkPack的版本，主要由lru_kv构成。因为chunkPack记录了该次查询chunk下全部分区的元数据版本，一旦chunkPack确定，slicePack与dbmPack的版本信息将确定，但该本地缓存的chunkPack版本是否符合本次查询要求，在pn端无法判断，因此需要到dn进行校验。meta manifest记录缓存中该chunk最新的chunkPack，当校验版本时，只需要校验最新版本是否符合本次查询即可。

####   [4.3.1 chunk set](#431-chunk-set)  

由于chunkPack是根据chunk进行管理版本（因为分区剪枝按chunk粒度进行剪枝，若每次缓存是全表的元数据，某一个分区发生变更，则整个元数据版本需要重新加载，且查询时不一定需要查询全量的chunk，因此版本控制以chunk为粒度），每个chunk都需要到dn校验，在chunk数多时，交互多，同样会影响性能。因此为了减少该网络交互，则全量chunkPack的版本一次性发送给dn进行交互，然后由dn返回那些chunk需要重新拉取，在进行该部分的chunkPack拉取即可。

![](https://pingcode.yasdb.com/atlas/files/public/67396ec18970c2af4f521b20/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUJBQUFRQUFBQUFBRWdBQUNBQUVBQUFDQUFBQWdJRUFBQUVBSUFBSVFBRUFRQUNBQUFBQUFBQUlHQUFBQUFBQUFBQUJBQUFBQUlnQUFBQUFBQUFBUUFBZ0FBQUFHQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NjAsImV4cCI6MTc4MjQ0OTY2MH0.ffUguBgJXyAQl-ufRQl-5Sj3opqZ9auSWMdgy-3w3LM)

chunkSet流程如下：

![](https://pingcode.yasdb.com/atlas/files/public/67396ec1a1ad9a3311dc9992/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUJBQUFRQUFBQUFBRWdBQUNBQUVBQUFDQUFBQWdJRUFBQUVBSUFBSVFBRUFRQUNBQUFBQUFBQUlHQUFBQUFBQUFBQUJBQUFBQUlnQUFBQUFBQUFBUUFBZ0FBQUFHQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NjAsImV4cCI6MTc4MjQ0OTY2MH0.ffUguBgJXyAQl-ufRQl-5Sj3opqZ9auSWMdgy-3w3LM)

1. openChunkSet，先从meta manifest中找寻该chunk最新版本。
1. 根据该版本信息，到meta cache中查找。
1. 根据meta cache找到的chunk版本，组装为chunkVersionSet。（不存在与meta cache中的chunkPack的版本为0，因为meta cache与manifest是两个不同结构，因此释放时机不同，因此不一定相对应）
1. 发送chunkVersionSet到dn端进行校验，不满足该次查询的chunk版本将组为chunkInvalidSet发回给pn。
1. pn根据chunkInvalidSet情况，重新加载chunk元数据，并刷新meta manifest记录。


###   [4.4 版本控制](#44-版本控制)  

由于pn不感知事务，元数据发生变更后，无法感知，因此需要机制来感知元数据变更情况，用于校验pn缓存元数据是否满足可见性。

由于可见性，当元数据发生变更后，coral可能因为查询scn发生回滚操作等，因此使用scn作为版本号进行控制。

####   [4.4.1 版本变更](#441-版本变更)  

根据ap场景，元数据大多情况下都是不变的，而需要回滚的情况下，根据事务内可见性进行回滚直到一个可见版本，此情况下若dn每次校验都需要进行fetch找到最终版本来对比是否进行过元数据变更，从而判断pn缓存元数据是否可用。这样的消耗通常是不必要的。而且需要回滚的版本，若缓存起来，由于大多数情况下回滚的版本都不一致，因此容易淘汰掉更有缓存意义的元数据。

根据以上问题，即考虑在dc中添加版本控制，当发生元数据变更后，获取最新的scn作为版本，从而可用通过查询scn与版本scn快速判断本地缓存是否符合查询要求。

![](https://pingcode.yasdb.com/atlas/files/public/67396ec1a1ad9a3311dc9993/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUJBQUFRQUFBQUFBRWdBQUNBQUVBQUFDQUFBQWdJRUFBQUVBSUFBSVFBRUFRQUNBQUFBQUFBQUlHQUFBQUFBQUFBQUJBQUFBQUlnQUFBQUFBQUFBUUFBZ0FBQUFHQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NjAsImV4cCI6MTc4MjQ0OTY2MH0.ffUguBgJXyAQl-ufRQl-5Sj3opqZ9auSWMdgy-3w3LM)

- 加载dc时，dc各分区的dcMetaVersion中记录的版本为最新的scn，ref为0。
- 当元数据未发生变更时，dc中各分区的dcMetaVersion的ref为0。
- 当元数据变更时，会上slice锁的同时，在dc中对应的分区的dcMetaVersion结构中的ref++，同时chunk的dcMetaVersion结构中的ref++，代表版本正在变更。
- 当事务回滚时，slice锁上记录的分区的dcMetaVersion结构中的ref--，同时chunk的dcMetaVersion结构中的ref--，然后放锁。
- 当事务提交时，slice锁上记录的分区的dcMetaVersion结构中版本根据行为，分别刷新对应版本为最新的scn，ref--， 同时chunk的dcMetaVersion结构中的对应版本为最新的scn，ref--， 然后放锁。


目前版本升级行为分为4类：

1. no change（没有发生元数据变更）
1. slice change （只发生slice元数据变更，只更新slice元数据版本，多为新增slice操作）
1. dbm change （只发生dbm元数据变更，只更新dbm元数据版本，多为删除更新操作）
1. slice and dbm change （slice与dbm元数据同时发生变更，更新slice与dbm元数据版本，多为compact操作）


####   [4.4.2 chunkPack版本加载](#442-chunkpack版本加载)  

元数据加载时分为两个版本：

- 稳态版本（元数据为一般查询均可见版本，chunkPack元数据将缓存进meta cache中）
- 临时版本（由于可见性，或者需要回滚，标记为临时版本，只满足本次查询要求，chunkPack元数据并不会添加进meta cache中）


当pn需要加载chunkPack时，会把查询scn，chunk信息发送到dn端。

dn端接收到后，打开dc，根据分区情况组装chunkPack各分区信息，其中该chunkPack的版本信息为各分区最大版本号，若存在一个临时版本，则该chunkPack为临时版本。若不存在临时版本，则chunkPack为稳态版本。

|dn端分区dcMetaVersion的ref是否为0|是否存在事务信息|dn端分区的dcMetaVersion信息大于查询scn|结论|
|---|---|---|---|
|false|true||分区发生事务，涉及元数据变更，且与本次查询事务可能相关，chunkPack记录该分区版本为查询scn，标记为临时版本|
|false|false|true|分区发生事务，涉及元数据变更，但与本次查询事务无关，但可见版本需要回滚，因此chunkPack记录该分区版本为查询scn，标记为临时版本|
|false|false|false|分区发生事务，涉及元数据变更，但与本次查询事务无关，可见版本无需回滚，因此chunkPack记录该分区版本为分区dcMetaVersion的版本，标记为稳态版本|
|true|false|true|分区未发生事务，但可见版本需要回滚，因此chunkPack记录该分区版本为查询scn，标记为临时版本|
|true|false|false|分区未发生事务，可见版本无需回滚，因此chunkPack记录该分区版本为分区dcMetaVersion的版本，标记为稳态版本|


![](https://pingcode.yasdb.com/atlas/files/public/67396ec18970c2af4f521b21/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUJBQUFRQUFBQUFBRWdBQUNBQUVBQUFDQUFBQWdJRUFBQUVBSUFBSVFBRUFRQUNBQUFBQUFBQUlHQUFBQUFBQUFBQUJBQUFBQUlnQUFBQUFBQUFBUUFBZ0FBQUFHQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NjAsImV4cCI6MTc4MjQ0OTY2MH0.ffUguBgJXyAQl-ufRQl-5Sj3opqZ9auSWMdgy-3w3LM)

![](https://pingcode.yasdb.com/atlas/files/public/67396ec1a1ad9a3311dc9994/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQkFBQUFBQWdBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFRQUFBQUFBQUJBQUFRQUFBQUFBRWdBQUNBQUVBQUFDQUFBQWdJRUFBQUVBSUFBSVFBRUFRQUNBQUFBQUFBQUlHQUFBQUFBQUFBQUJBQUFBQUlnQUFBQUFBQUFBUUFBZ0FBQUFHQUFBQUFBQUFBQUFBUUFBQUFBQUFBQUNBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0Mzg4NjAsImV4cCI6MTc4MjQ0OTY2MH0.ffUguBgJXyAQl-ufRQl-5Sj3opqZ9auSWMdgy-3w3LM)

####   [4.4.3 chunk版本校验](#443-chunk版本校验)  

当缓存chunkPack版本跟随chunk set发送给dn端时，先获取该dc，然后获取该chunk的dcMetaVersion，对比：

|dn端chunk的dcMetaVersion的ref是否为0|是否存在事务信息|dn端分区的metaVersio信息等于pn缓存版本|结论|
|---|---|---|---|
|false|true||分区元数据发生变更，且可能与该事务有关，缓存元数据不可用|
|false|false|false|分区元数据发生变更，但与本次查询不可见，但缓存元数据与最新不一致，部分分区需要回滚获取可见元数据，缓存元数据不可用|
|false|false|true|分区元数据发生变更，但与本次查询不可见，缓存元数据与可见元数据一致，缓存元数据可用|
|true|false|false|分区元数据未发生变更，但缓存元数据与可见版本不一致，缓存元数据不可用|
|true|false|true|分区元数据未发生变更，缓存元数据与可见元数据一致，缓存元数据可用|


####   [4.4.4 slice/dbm版本](#444-slicedbm版本)  

当chunkPack确定后，后续查询某个分区时，从chunkPack中获取出该分区的slice与dbm版本，获取该版本元数据：

|slice/dbm版本为临时版本|是否存在meta cache中|结论|
|---|---|---|
|true||为临时版本，需要到dn进行加载元数据，加载scn为版本号，加载的元数据无需加入cache中|
|false|false|为稳态版本，但pn端无缓存，需要到dn进行加载元数据，加载scn为版本号，加载的元数据加入cache中|
|false|true|为稳态版本，且在缓存中，可使用缓存元数据|


####   [4.4.5 主备版本](#445-主备版本)  

由于版本控制与dc相关，版本不会持久化，主机随dc加载时机，事务提交时机的scn作为版本，而备机则是在备机上加载dc时机的scn作为版本，因此主备之间版本是不一致的。备机在回放时不上slice锁，因此不会进行版本变更。一般情况下，查询不会到备机拉取元数据。

但存在主备切换的故障情况：

- 主备切换，查询拉取元数据节点变为备机。由于节点主备切换，事务可能发生回滚操作，导致备机查询到元数据不一致。因此拉取元数据时检测为备机，则报错。（遗留问题：分布式下拉取元数据时节点从主降备，又从备升主后，事务信息被回滚，但元数据拉取无感知，目前分布式查询也有类似问题。）
- 主备切换前，备机进行查询，初始化版本信息，后主机发生事务变更，版本刷新，但备机版本不变，备机元数据版本与dc中记录不一致。当进行主备切换后，需要把dc无效重新初始化版本信息，保证一致性。


###   [4.5 视图](#45-视图)  

####   [V$PN_METACACHE](#vpn-metacache)  

|字段|类型|描述|
|---|---|---|
|OBJ|BIGINT|meta cache元数据所属的根表OID|
|DATAOID|BIGINT|meta cache元数据对象的DATAOID(CHUNKMETA为无效值)|
|CHUNKID|INTEGER|meta cache元数据对象的CHUNKID|
|VERSION|BIGINT|meta cache缓存的元数据版本|
|READNUM|BIGINT|meta cache元数据读取次数|
|TYPE|INTEGER|meta cache缓存的元数据类型(chunk， slice，dbm)|
|SIZE|INTEGER|meta cache缓存的元数据大小|
|QUEUE|INTEGER|meta cache缓存的元数据所处队列(old, cold, hot)|
|REF|BIGINT|meta cache缓存的元数据正在被引用次数|
|START_TIME|BIGINT|meta cache缓存元数据加载起始时间|
|LOAD_TIME|BIGINT|meta cache缓存元数据加载使用时间|
|LOAD_GROUP|INTEGER|meta cache缓存元数据加载节点|


####   [V$DC_PART_STAT](#vdc-part-stat)  

显示DN端的元数据最新版本与状态，通过获取表的DC各个分区获取DC上的状态。该视图只在DN端显示内容，且只显示LSC表的内容。

|字段|类型|描述|
|---|---|---|
|OBJ|BIGINT|DN端对象元数据所属的根表OID|
|DATAOID|BIGINT|DN端对象元数据的DATAOID(CHUNKMETA为无效值)|
|CHUNKID|INTEGER|DN端对象元数据的CHUNKID|
|VERSION|BIGINT|DN端对象SLICE元数据版本|
|TYPE|INTEGER|版本类型|


####   [V$SYS_STAT添加字段](#vsys-stat添加字段)  

该添加字段内容只在PN端可查询到对应内容，其他节点均为0。

|字段|类型|说明|
|---|---|---|
|PN_METACACHE_HITS_NUM|BIGINT|meta cache命中次数|
|PN_METACACHE_MISS_NUM|BIGINT|meta cache未命中次数|
|PN_METACACHE_LOAD_NUM|BIGINT|meta cache加载次数|
|PN_METACACHE_LOAD_TIME|BIGINT|meta cache加载时间|
|PN_METACACHE_LOAD_SIZE|BIGINT|meta cache加载大小|
|PN_METACACHE_INVALID_LOAD_NUM|BIGINT|meta cache无效加载次数|
|PN_METACACHE_INVALID_LOAD_SIZE|BIGINT|meta cache无效加载大小|
|PN_METACACHE_INVALID_LOAD_TIME|BIGINT|meta cache无效加载时间|
|PN_METACACHE_EVICT_NUM|BIGINT|meta cache淘汰次数|
|PN_METACACHE_TEMP_LOAD_NUM|BIGINT|meta cache临时版本加载次数|
|PN_METACACHE_TEMP_LOAD_SIZE|BIGINT|meta cache临时版本加载大小|
|PN_METACACHE_TEMP_LOAD_TIME|BIGINT|meta cache临时版本加载时间|
|META_AGENT_CALL_META_NUM|BIGINT|meta cache元数据通信次数|
|META_AGENT_CALL_META_TIME|BIGINT|meta cache元数据通信时间|


##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

略

##   [7.未来规划](#7未来规划)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

  


  


## Attachments:

[metaVersion.JPG](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzA4OTcwYzJhZjRmNTIxYjE1IiwicmVmX2lkIjoiNjczOTZlYzA1OTNmOTljOWZmMjM4OGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODYwLCJleHAiOjE3ODI1MjUyNjB9.p9aFrMTe0At_wLj0exvHcfD5q-xccqrfGfTko1H6ASs)

 (image/jpeg)    


[metaVersion一致性.JPG](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzA4OTcwYzJhZjRmNTIxYjFkIiwicmVmX2lkIjoiNjczOTZlYzA1OTNmOTljOWZmMjM4OGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODYwLCJleHAiOjE3ODI1MjUyNjB9.ujFkklROtATLSzc1IrxyuZqjDLJlHMtPTNLLLX_5zDI)

 (image/jpeg)    


[metaVersion一致性.JPG](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlYzA4OTcwYzJhZjRmNTIxYjFlIiwicmVmX2lkIjoiNjczOTZlYzA1OTNmOTljOWZmMjM4OGNiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM4ODYwLCJleHAiOjE3ODI1MjUyNjB9.kxJZ5iS6pTDH4wEKJd0O3IwTa9kEFSbTZYrpVjU9uUE)

 (image/jpeg)    
