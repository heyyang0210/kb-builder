Created by 黄杨波, last modified on 四月 18, 2024

#   [YDBRD-25891 : 集群支持全局block资源dump](#ydbrd-25891--集群支持全局block资源dump)  

  [https://pingcode.yasdb.com/pjm/items/6611a8eb579a3edb84d861c9](https://pingcode.yasdb.com/pjm/items/6611a8eb579a3edb84d861c9)    ?#YDBRD-25891 集群支持全局block资源dump

##   [1. Overview（概述）](#1-overview概述)  

目前单机下支持alter system dump datafile语法指定dump出某个datafile下一个或多个连续的block的信息到diag/trace目录下供用户查看。但目前dump出来的内容只有disk block里的block haed以及block的具体内容，dump出来的效果和直接用yasminer解的效果类似，为了便于开发分析问题，需要额外dump出buffer ctrl以及gcs信息。

##   [2. Features（功能特性）](#2-features功能特性)  

单机和集群下执行alter system dump datafile能dump出指定file下的一个或多个连续的block内容到diag/trace目录下，dump出来的内容包含buffer ctrl信息、gcs信息、disk block内容。

##   [3. Interfaces（接口）](#3-interfaces接口)  

1.函数接口

|name|Meaning|
|---|---|
|AXC_CB->axcGatherDumpInfo|发送消息到master获取gcs res的dump信息|


2.消息接口

|name|function|Meaning|
|---|---|---|
|MSG_GATHER_DUMP_INFO|msgGatherDumpInfo|master处理获取gcs res dump信息的消息处理函数|


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

1.仅支持db open时dump

2.沿用alter system dump datafile语法，dump出来的内容根据部署形态以及block在buffer中的状态有所差异

1. 单机部署，block在buffer中：buffer ctrl、disk block
1. 集群部署，block在buffer中：buffer ctrl、gcs、disk block
1. 单机/集群部署，block不在buffer中：disk block（等效于yasminer解析）


3.通过查询V$BUFFER_CONTROL视图指定TS#、FILE#、BLK#（对应blockId 0-0-0）来判断block是否在buffer中

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Data Structures & Flow（数据结构与流程）](#51-data-structures--flow数据结构与流程)  

```
typedef union UnGrcResFlags {
    CodUint32 value;
    struct {
        CodUint32 inProcess : 1;
        CodUint32 isValid : 1;
        CodUint32 inRecover : 1;
        CodUint32 pcRemained : 1;
        CodUint32 unused : 28;
    };
} GrcResFlags;

```

```
typedef struct StGcsDumpInfo {
    CodUint32   id;
    CodUint32   next;
    CodUint32   bucket;
    GrcResFlags flags;
    CodUint16   xOwner;
    CodUint8    refCount;
    CodUint8    ownerCount;
    BlockId     blockId;
    CodUint64   ownerMap;
    CodUint64   pcMap;
    CodUint32   reqCnt;
    GrcReqIdent reqList[AXC_MAX_INSTANCES];
} GcsDumpInfo;

```

###   [5.2 方案实现](#52-方案实现)  

####   [5.2.1 方案设计](#521-方案设计)  

1.原有方案概述：目前的alter system dump datafile实现是先调用bpAttachBlockR接口将block读到buffer中再进行解析dump到diag/trace目录下。这种做法的弊端在于，原来该block在buffer中不存在，却因为dump的操作导致其加载到buffer，会对用户产生误导，dump出来的buffer ctrl信息也是不还原的。

2.经调研oracle rac的dump表现得到以下结论：如果block一开始不存在于buffer中，执行dump则只会dump出disk block内容，没有buffer ctrl以及gcs信息，反之则会基于buffer中的ctrl信息打印buffer ctrl以及gcs内容。这样的预期是更加合理且真实的。

3.基于上述两点，可以明确dump block的预期表现如下：

1. 单机部署，block在buffer中：buffer ctrl、disk block
1. 集群部署，block在buffer中：buffer ctrl、gcs、disk block
1. 单机/集群部署，block不在buffer中：disk block（等效于yasminer解析）


4.方案流程图：

![](https://pingcode.yasdb.com/atlas/files/public/67396d828970c2af4f52133e/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQWdBQUFBQUFBQUFnQUFBQUFDQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUlBQUFBUUFBZ0FBQUFBQUFJQUFBQUFBQUFJQUFBQUJBQVFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBUUFBQkFBQUJBQUFBQUlBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg4OTksImV4cCI6MTc4MjMxOTY5OX0.VTLfP6RsCbBkB7UlGTRLtz3dQu3r08IKfON4MmeFfwE)

5.问题讨论：

- BP_IS_LOADED && !isRecycling确保buffer中有block ctrl，且是已经是loaded block的状态，此时refCount++确保dump过程中该ctrl不会被recycle，但此处会存在并发问题：


1. 如果为CR BLOCK CTRL，则仅通过refCount++保证不被recycle即可，因为其他session不会使用CR CTRL去latch block，此时dump过程中buffer ctrl和addr内容理论上不会发生变化
1. 如果为CURRENT BLOCK CTRL，虽然可以通过refCount++保证不被recycle，但此时其他session可以并发的latch block去走gcs流程申请block，此时dump过程中buffer ctrl和addr的内容是可能发生变化的，但理论上不影响dump，只是可能影响dump的打印内容


- 若buffer中不存在block ctrl，则需要直接readDevice加载block，此过程读上来的block可能是坏的，因为可能并发的有其他实例正在刷盘，因此读上来需要做block校验检查，如果block损坏则不dump block内容
- 集群下不支持aim block，dump aim block只会dump出buffer ctrl和addr信息
- 如果buffer中有多个cr ctrl + current ctrl，是只dump current ctrl还是全部都dump出来？
- 如果没有current ctrl，只有多个cr ctrl，是只随便dump一个cr ctrl还是全部dump出来？


####   [5.2.2 dump信息字段细节](#522-dump信息字段细节)  

1.block dump from cache

![](https://pingcode.yasdb.com/atlas/files/public/67396d828970c2af4f52133f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQWdBQUFBQUFBQUFnQUFBQUFDQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUlBQUFBUUFBZ0FBQUFBQUFJQUFBQUFBQUFJQUFBQUJBQVFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBUUFBQkFBQUJBQUFBQUlBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg4OTksImV4cCI6MTc4MjMxOTY5OX0.VTLfP6RsCbBkB7UlGTRLtz3dQu3r08IKfON4MmeFfwE)

dump信息主要分为三大部分

- Part 1：BUFFER CTRL DUMP（buffer ctrl的dump信息）


1. OBJ#：该block属于哪个对象，如果block不属于任何对象（如space head block、bitmap block等），则该字段为-1
1. isFlushing：是否被ckpt标记正在刷盘
1. isPinned：block unrecyclable temporarily. Such as undo blocks in rollbacking属于一种block不可被recyle的状态
1. isResident：是否是常驻页面，如temp extent map block
1. isAim：是否是all in memory block，在创建表空间时指定MEMORY MAPPED字段
1. isGcConverting：是否有线程正在走gcs流程申请latch block
1. isRemoteVisit：是否正在被远端请求访问（其他实例发来的block相关的消息请求）
1. 其余字段参考V$BUFFER_CONTROL:     [https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$BUFFER_CONTROL.html](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E7%B3%BB%E7%BB%9F%E8%A7%86%E5%9B%BE/%E5%8A%A8%E6%80%81%E8%A7%86%E5%9B%BE/V$BUFFER_CONTROL.html)  


- Part 2：GLOBAL CACHE SERVICE DUMP（gcs resource的dump信息）


1. master：在集群下管理该blockId的gcs资源的实例
1. id：gcs resource id（grm entry中的id）
1. bucketId：gcs resource所在的bucketId
1. hashNext：所在bucket的下一个gcs resource
1. flag：对应GrcResFlags结构体
1. refCount：gcs resource的引用次数
1. LIST OF REQUEST DUMP：gcs resource当前的请求队列信息（队列最长为64）


- Part 3：DISK BLOCK DUMP（实际数据页面的dump内容，沿用单机）


![](https://pingcode.yasdb.com/atlas/files/public/67396d828970c2af4f521340/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQWdBQUFBQUFBQUFnQUFBQUFDQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUlBQUFBUUFBZ0FBQUFBQUFJQUFBQUFBQUFJQUFBQUJBQVFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBUUFBQkFBQUJBQUFBQUlBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg4OTksImV4cCI6MTc4MjMxOTY5OX0.VTLfP6RsCbBkB7UlGTRLtz3dQu3r08IKfON4MmeFfwE)

2.block dump from disk

![](https://pingcode.yasdb.com/atlas/files/public/67396d82a1ad9a3311dc91b1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBUUFBQUFBQUFBQWdBQUFBQUFBQUFnQUFBQUFDQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUlBQUFBUUFBZ0FBQUFBQUFJQUFBQUFBQUFJQUFBQUJBQVFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBUUFBQkFBQUJBQUFBQUlBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg4OTksImV4cCI6MTc4MjMxOTY5OX0.VTLfP6RsCbBkB7UlGTRLtz3dQu3r08IKfON4MmeFfwE)

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. db非open状态下dump block
1. db不带业务下dump（不在buffer/在buffer）中的block（data block、space head block、bitmap block、undo block、aim block等等）
1. db带各种正常业务并发下dump block
1. db启停并发下dump block
1. db故障并发下dump block


##   [7.资料设计章节](#7资料设计章节)  

涉及修改文档说明不同场景下dump datafile的内容差异

## Attachments:

[image2024-4-9_17-5-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODJhMWFkOWEzMzExZGM5MWFhIiwicmVmX2lkIjoiNjczOTZkODI1OTNmOTljOWZmMjM3YzBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODk5LCJleHAiOjE3ODIzOTUyOTl9.b0IzDqrAkObwzVGTL_5Xv3a_ukowCCVQTmNZAh4ryOI)

 (image/png)    


[image2024-4-9_17-22-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODI4OTcwYzJhZjRmNTIxMzM3IiwicmVmX2lkIjoiNjczOTZkODI1OTNmOTljOWZmMjM3YzBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODk5LCJleHAiOjE3ODIzOTUyOTl9.Tw3RUg9HGOQXb2ogGB5WkQzvi24r9oq_dMu1YDzvxK4)

 (image/png)    


[image2024-4-9_18-9-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODI4OTcwYzJhZjRmNTIxMzM4IiwicmVmX2lkIjoiNjczOTZkODI1OTNmOTljOWZmMjM3YzBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODk5LCJleHAiOjE3ODIzOTUyOTl9.S-kGjlLAUEeElWIZC2j__ytzok6TDAXr_eaXr6W59LE)

 (image/png)    


[image2024-4-9_18-51-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODJhMWFkOWEzMzExZGM5MWFiIiwicmVmX2lkIjoiNjczOTZkODI1OTNmOTljOWZmMjM3YzBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODk5LCJleHAiOjE3ODIzOTUyOTl9.UL8hGfUViwKCCLy7YYLVj7NZo1UdFXcac15CsdaFAyU)

 (image/png)    


[image2024-4-9_19-10-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODI4OTcwYzJhZjRmNTIxMzM5IiwicmVmX2lkIjoiNjczOTZkODI1OTNmOTljOWZmMjM3YzBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODk5LCJleHAiOjE3ODIzOTUyOTl9.4eBvQ1ZQDj_olTX85mGa3xxXXJRFNrY_yR834YuqYsA)

 (image/png)    


[image2024-4-10_10-34-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODI4OTcwYzJhZjRmNTIxMzNhIiwicmVmX2lkIjoiNjczOTZkODI1OTNmOTljOWZmMjM3YzBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODk5LCJleHAiOjE3ODIzOTUyOTl9.LOGIr5qWXFzXuZfoYU3oreREF8iUn4omWHieQ5BjDVI)

 (image/png)    


[image2024-4-10_11-6-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODJhMWFkOWEzMzExZGM5MWFjIiwicmVmX2lkIjoiNjczOTZkODI1OTNmOTljOWZmMjM3YzBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODk5LCJleHAiOjE3ODIzOTUyOTl9.GCtGuWOG16uywr8s_YPZFdw6nhn9o_H2OU7mkHEUMts)

 (image/png)    


[image2024-4-10_11-44-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkODJhMWFkOWEzMzExZGM5MWFkIiwicmVmX2lkIjoiNjczOTZkODI1OTNmOTljOWZmMjM3YzBiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4ODk5LCJleHAiOjE3ODIzOTUyOTl9.pMUvkHV9UrS-Cw-h3qzfpSYB5uJohzlqqUzlrWsig4E)

 (image/png)    


## Comments:

|  [](null)  ,oracle rac alter system dump datafile调研文档：    [Dump datafile方案设计 - 黄杨波 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=147781199)  ,Posted by huangyangbo at 四月 10, 2024 14:49|
|---|
