Created by 龙忠友, last modified on 八月 11, 2023

## 1. Overview（概述）

     在线恢复过程中，会对block进行分析，然后构造recovery set，这时会对block进行访问，而此时处于reform的latchExclusive还没释放，不能走原有的grc处理流程；同时此时的block访问，也不需要在master进行登记；同时在recovery set构造完成后，需要提供对yasql的访问(不在recovery set里面的)

## 2. Features（功能特性）

- 提供构造recovery set时的block请求
- recovery set构建完成后，提供block不在recovery set里面的正常访问


## 3. Interfaces（接口）

3.1. 外部接口

|函数名|返回值|参数|描述|备注|
|---|---|---|---|---|
|axcReqRecoverBlock|CodResult|in：AnkHandler* handler,in：BlockId bid,out：CodChar* block,out：CodUint8* status|恢复实例向GRC请求一个block，用于分析过滤构建recovery set,status值是一个枚举：BlockRecoverStatus：BP_CURR_BLOCK, BP_DIRTY_BLOCK， BP_LOAD_BLOCK, BP_PC_BLOCK|  
|
|axcLatchRecoverBlock|CodVoid|in：AnkHandler* handler,in：BlockId bid,in：CodBool latch|通知GRC加锁或释放锁,latch：COD_TRUE  加锁,latch：COD_FALSE 释放锁|  
|


  


3.2. 内部接口

|消息ID|callback|task|备注|
|---|---|---|---|
|MSG_REQ_RECOVER_BLOCK|msgReqRecoverBlock|AXC_GRC_TASK|  
|
|MSG_ASK_OWNER_SEND_PASTCOPY|msgAskOwnerSendPastcopy|AXC_GCS_TASK|  
|
|MSG_ASK_OWNER_SEND_PASTCOPY_ACK|msgAskOwnerSendPastcopyAck|AXC_FG_TASK|  
|
|MSG_REQ_LATCH_BLOCK|msgReqLatchBlock|AXC_GRC_TASK|  
|


## 4. Limitations（功能限制）

  


## 5. Detail Design（详细设计）

5.1. 数据结构

```
typedef struct StGrcResource {
    CodUint32  id;          // resource id
    CodUint32  next;        // hash list next when allocated, free list next when freed
    GrcResName name;        // block id is valid if resType is block resource, otherwise lock id is valid
    CodBool    inProcess;   // a request is being processed
    CodBool    isValid;
    CodBool    inRecover;   // recovering
    CodBool    withoutOwner;// whether an owner exists after the grc resource is recovered
    CodUint8   type;        // resource type: block resource or non-block resource
    CodUint8   unused[3];
    CodUint8   refCount;    // decide whether the resource can be recycled
    CodUint8   ownerCount;  // owner count of the resource
    CodUint16  xOwner;      // current X owner of the resource
    CodUint32  pastCopy;    // the least past copy of the resource
    CodUint64  ownerMap;    // owner map of the resource
    CodUint64  auxMap;      // owner map of past copy(block resource), auxiliary statistics for broadcast unlock(non-block resource)
    GrcRequest request;     // current converting request
    GrmList    reqList;     // queued request list when converting
} GrcResource;

typedef enum EnReqRecoverBlockStatus {
	BP_CURR_BLOCK,              // curr block
    BP_CURR_DIRTY_BLOCK,        // curr dirty block
	BP_LOAD_BLOCK,              // load block
	BP_PC_BLOCK,                // pastcopy block
} ReqRecoverBlockStatus;
```

GrcResource结构增加一个字段inRecover，标识资源正在恢复中，具体的用途为：

- 如果一个block正在恢复，那么对应的master资源inRecover被设置为COD_TRUE，恢复结束后设置为COD_FALSE。
- 正常请求获取master资源时，如果inRecover为CO_TRUE，则此时不能访问。


  


GrcResource结构增加一个字段withoutOwner，标识资源重建后是否存在owner：

- grc资源重建中，如果有PC但不存在owner则设置为COD_TRUE，否则为COD_FALSE，当后续有请求产生owner后，设置为COD_FALSE
- 在PC反向清理中，如果没有xOwner，还需要判断withoutOwner，如果withoutOwner=COD_TRUE; 不能直接清除PC，需要pc owner读盘，比较一下lsn，如果disk数据是新的，则可以直接清除PC，否则不能清除。


  


5.2. axcReqBlockForRecover处理流程

该函数的处理流程如下图：

![](https://pingcode.yasdb.com/atlas/files/public/67396b49a1ad9a3311dc81d7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTI2NjMsImV4cCI6MTc4MjMwMzQ2M30.AucTVdug38vsGh92ldtyiUDrTXZGIhdbFHsbIenS0FA)

  


5.3. axcLatchBlockForRecover处理流程

该函数处理较为简单，获取对应的资源master实例，然后master实例获取对应的资源

- 如果是加锁，则修改  inRecover为COD_TRUE。
- 如果释放锁，则修改inRecover为COD_FLASE。


  


5.4. 恢复时资源在线访问

master处理正常的block资源访问时，如果资源处于正在恢复中(  inRecover为COD_TRUE  )，则不能访问，否则可以访问。

  


## 6. Testcases（用例）

  


## 7. Workload（工作量）

1. 评估代码量KLOC = xxx行
1. 评估工作量 =xxx（人天）


## 8. TODO（遗留问题）

  




  


## Attachments:

[remaster.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDg4OTcwYzJhZjRmNTIwMzU4IiwicmVmX2lkIjoiNjczOTZiNDg3MjgyMDZlZmI5MmYwM2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjYyLCJleHAiOjE3ODIzNzkwNjJ9.5oA5H1DC1ttKHVj89pP8pv8rvrYdVsxxJvqryMg4BZE)

 (image/png)    


[image2023-7-13_20-9-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDg4OTcwYzJhZjRmNTIwMzU5IiwicmVmX2lkIjoiNjczOTZiNDg3MjgyMDZlZmI5MmYwM2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjYyLCJleHAiOjE3ODIzNzkwNjJ9.HXMWUMKb08-wLwwi8UrVkUKXF8yg3t-FYBq-iGgD5B8)

 (image/png)    


[image2023-7-13_20-9-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDg4OTcwYzJhZjRmNTIwMzVhIiwicmVmX2lkIjoiNjczOTZiNDg3MjgyMDZlZmI5MmYwM2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjYyLCJleHAiOjE3ODIzNzkwNjJ9.Z4FW4UsQVVJW9HlMrwY81X5HLhFlNs8VoXwxNIxinEc)

 (image/png)    


[axcreqBlock.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDk4OTcwYzJhZjRmNTIwMzViIiwicmVmX2lkIjoiNjczOTZiNDg3MjgyMDZlZmI5MmYwM2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjYyLCJleHAiOjE3ODIzNzkwNjJ9.nksr41gujo-m_RKBstY-kDyb8CY2qv-w3KI3Dj527DI)

 (image/png)    


[axcreqBlock.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDlhMWFkOWEzMzExZGM4MWQyIiwicmVmX2lkIjoiNjczOTZiNDg3MjgyMDZlZmI5MmYwM2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjYyLCJleHAiOjE3ODIzNzkwNjJ9.7qUUzjamVfEwV5hoUcTH7Ew-lx6AqLQEHtJftkTwvNs)

 (image/png)    


[axcreqBlock.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDlhMWFkOWEzMzExZGM4MWQzIiwicmVmX2lkIjoiNjczOTZiNDg3MjgyMDZlZmI5MmYwM2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjYyLCJleHAiOjE3ODIzNzkwNjJ9.CJkIAA4KlQP80TYeeeevGHwCKFOX58YOA723504m2jU)

 (image/png)    


[axcreqBlock.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDk4OTcwYzJhZjRmNTIwMzVkIiwicmVmX2lkIjoiNjczOTZiNDg3MjgyMDZlZmI5MmYwM2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjYyLCJleHAiOjE3ODIzNzkwNjJ9.38dkp0FQ4s4PbnYfcEeGdkTQATviWRyaVsHyV8oMX3I)

 (image/png)    


[axcreqBlock.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNDlhMWFkOWEzMzExZGM4MWQ1IiwicmVmX2lkIjoiNjczOTZiNDg3MjgyMDZlZmI5MmYwM2RmIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjkyNjYyLCJleHAiOjE3ODIzNzkwNjJ9.fqrPnRROXugIXpmTdDFM0W5iC-yNQLFdTS-hfxJr8cI)

 (image/png)    
