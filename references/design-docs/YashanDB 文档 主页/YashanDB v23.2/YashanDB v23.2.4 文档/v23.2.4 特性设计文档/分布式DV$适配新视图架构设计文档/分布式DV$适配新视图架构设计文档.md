Created by 冯浩楠, last modified on 六月 13, 2024

  [https://pingcode.yasdb.com/pjm/items/6611601e579a3edb84d6c335](https://pingcode.yasdb.com/pjm/items/6611601e579a3edb84d6c335)    ?    
  #YDBRD-19974 新框架分布式dv适配

## 1. 总述

旧版本下v$开头的视图直接将列定义写在了代码中，在需要访问数据的时候直接进行实时的fetch，这种做法更接近于Oracle的x$表，即fixed_table，这种类型的对象将自身的列定义固化在代码中，在获取数据时根据数据库内相关信息实时生成。

而Oracle的动态视图则是由sql语句实现，此类对象也被称为fixed_view。也就是说，之前yasdb内实现的动态视图更接近于Oracle定义的fixed_table而不是fixed_view。

- fixed table是一种新的表类型，其类似当前版本的dynamic view，当前版本的dynamic view本质上是一种dynamic table。其固定是定义的，数据是动态的，并且fixed table存在一定的约束（    [fixed table](fixed-table_109603812.html)    、    [fixed view](fixed-view_109603815.html)    ）。
- fixed view是真正意义上的dynamic view，概念上dynamic view全称为dynamic performance view – 动态性能视图，其强调的是数据是动态变化的一类性能视图。


在需求    [YDBRD-12300](https://jira.yasdb.com/browse/YDBRD-12300?src=confmacro)    -  集群支持全局动态视图  完成        中，于执行引擎内分离了fixed table和fixed view两个不同的对象，将旧有dynamic_view更换成fixed_table + fixed_view的新框架实现。

本需求主要是分布式视图适配新的视图框架，视图语法上进行调整，并引入了权限控制：

1. 分布式视图框架调整
1. 分布式视图权限控制（grant select_catalog_role to user）
1. 视图语义重定义


### 1.1 需求来源

内部框架优化

### 1.2 调研文档

  [动态视图调研](https://conf.yasdb.com/pages/viewpage.action?pageId=122064112)  

  [分布式视图语义](https://conf.yasdb.com/pages/viewpage.action?pageId=133581409)  

  [Oceanbase视图方案](https://conf.yasdb.com/pages/viewpage.action?pageId=153004826)  

|部署模式|OB|Oracle-sharding|
|---|---|---|
|单机|V$|V$|
|集群|GV$|GV$|
|分布式|GV$|shrads(v$)|


### 1.3 需求分析

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|兼容性|  
|----|是/否|是/否|
|功能|子功能1|子功能1通过什么方案满足|是/否|是/否|
|可修改性|----|----|是/否|是/否|
|可用性|恢复场景|----|是/否|是/否|
|可维可测|DFX功能1|----|是/否|是/否|
|可靠性|故障场景|----|是/否|是/否|
|周边配合|权限|----|----|是/否|
|周边配合|审计|----|----|是/否|
|周边配合|导入导出工具|----|----|是/否|
|安全|安全场景1|----|是/否|是/否|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|是/否|是/否|
|易用性|----|----|是/否|是/否|


  


2. Interfaces（接口）

原先分布式动态视图DV$全部更名为GV$。

## 3. Specification And Constraints（规格与约束）

待定

无新增约束，能力与之前保持一致（    [YDBRD-6636：分布式支持dv$视图之间的join](112724817.html)    ）：

1. 对dv$视图的所有操作都在收到计划的节点本地执行，最后再汇总到CN，不同节点间的数据不做任何关联聚集操作。
1. order by，group by，窗口函数，聚集函数，limit，rownum 都只在收到计划的节点内生效，CN只做汇总。order by在CN汇总后可能不是有序的；group by可能有重复的；limit限制各节点的条数，最终CN返回的是节点数*limit数。
1. dv$和DBA视图、dv$和系统表、dv$和v$，升级处理。对DBA视图、系统表，使用的都是各节点本地的数据；v$视图按dv$视图处理，等同于各节点的v$。
1. 只允许和DBA视图、USER视图、ALL视图、系统表、v$之间join。
1. DN上plan cache可能膨胀到多CN之和。在CN扩容时建议增加share_pool_size。


## 4. 特性

### 4.1 新旧方案对比

![](https://pingcode.yasdb.com/atlas/files/public/67396dcc8970c2af4f521545/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQWdBQUFBQUFBQVFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE3NzYsImV4cCI6MTc4MjMyMjU3Nn0.YyympwjaojNRllGMQeAqEYDZXaw-nX-MeuAcQNmt4ag)

旧的分布式视图通过计划下发各个节点（包含所有类型节点+主备）做本地动态视图查询后将结果汇总到CN，新的视图方案查询流程：

1. 将之前本地查询的结果转换成一个fix_table（增加了线管权限以及约束），将v$换成x$，  新框架中，需要尽量对原来较大的动态视图进行抽象，将不同视图的相同列尽量组合成一个x$固定表，x$的定义不是视图的定义。
1. 定义视图各个列，分布式视图相比单机视图增加GROUP_ID以及GROUP_NODE_ID来区分不同节点。
1. 通过查询各个x$（或者系统视图以及VIEW等）进行组合来为视图的每一列填入值。
1. 将视图转换成一个同名view来增加权限控制


### 4.2 分布式视图语义

#### **4.2.1 v$\dv$\gv$语义改造**

**原先语义：**

|部署场景|v$|dv$|gv$|x$|
|---|---|---|---|---|
|单机|正常输出|仅用于分布式|正常输出|非sys用户无法查询|
|集群|仅输出客户端连接节点数据|无法查询|输出当前集群所有活节点数据|非sys用户无法查询，仅输出当前节点数据|
|分布式|仅输出当前节点数据|查询所有节点数据|仅输出当前节点数据|非sys用户无法查询，仅输出当前节点数据|


**新的语义：**

|部署模式|v$|gv$|x$|dv$|shards(v$)|
|---|---|---|---|---|---|
|单机|正常输出|正常输出|非sys用户无法查询|不支持|  
|
|集群|仅输出客户端连接节点数据|输出当前集群所有活节点数据（部分视图除外）|非sys用户无法查询，仅输出当前节点数据|不支持|  
|
|分布式|仅输出当前节点数据|输出当前集群所有活节点数据,（部分视图除外）|非sys用户无法查询，仅输出当前节点数据|保留or删除|  
|


#### **4.2.2 **  视图行为分析：

  [dv视图查询范围分析](https://conf.yasdb.com/pages/viewpage.action?pageId=153017455)  

1.  集群/分布式专属的视图在其它部署模式下查询为空 or 不可查
1. 视图查询范围：
    1. 通过计划区分（不同查询范围的视图生成计划时取不同的节点，可以按foid按不同计划进行分段）。  — 实现复杂
    1. 计划一致，在fix_table中单独处理。 — 实现简单
1. gv视图提供范围：
    1. 所有视图都适配gv$视图，当各个节点数据重复时，显示重复数据。
    1. 所有视图都适配gv$视图，当各个节点数据重复时，gv内部实现按照v处理。
    1. 显示重复数据的，只提供v$视图。


### 4.3 分布式视图改造关键设计

![](https://conf.yasdb.com/download/attachments/150634288/%E8%A7%86%E5%9B%BE%E6%A1%86%E6%9E%B6.png?version=1&modificationDate=1714464092000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQWdBQUFBQUFBQVFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE3NzYsImV4cCI6MTc4MjMyMjU3Nn0.YyympwjaojNRllGMQeAqEYDZXaw-nX-MeuAcQNmt4ag)

  


#### 4.3.1 dv视图改造成gv

定义上，增加分布式视图的标记，并新增定义宏

```
typedef struct StFixedViewDef {
    CodText         name;
    FvColumn*       columns;
    CodUint16       columnCount : 14;
    CodUint16       isGlobal : 1;
    CodUint16       isDistribute : 1;    // 新增分布式动态视图标记
    CodUint16       version;
    CodText         fullText;
} FixedViewDef;

// 集群动态视图宏定义
#define GV_DEF(fvName, method, fvText, fvVer) \
    { \
        .name = COD_TEXT_DEF(fvName), .columns = gGV$##method##Cols, .columnCount = GV_COLUMN_COUNT(method), \
        .isGlobal = COD_TRUE, .fullText = COD_TEXT_DEF(fvText), .version = fvVer \
    }


// 分布式动态视图宏定义
#define DV_DEF(fvName, method, fvText, fvVer)                                                                \
    {                                                                                                        \
        .name = COD_TEXT_DEF(fvName), .columns = gDV$##method##Cols, .columnCount = DV2_COLUMN_COUNT(method), \
        .isDistribute = COD_TRUE, .fullText = COD_TEXT_DEF(fvText), .version = fvVer                             \
    }

```

**fix_view视图定义**

|  
|方案1|方案2|
|---|---|---|
|方案描述|分布式&集群统一显示GROUP_ID、GROUP_NODE_ID、INST_ID，只定义一个fix_view|分布式&集群定义两个fie_view:,- 分布式：GROUP_ID、GROUP_NODE_ID
- 集群：INST_ID
,  
|
|优点|- 只有一套定义，易维护
- 支持分布式共享集群
- fix_view的实现简单
- 资料：对外一个描述
- awr一套存储过程
|- 集群&分布式各自显示自己字段
- 支持定制字段
- GV与oracle RAC保持一致
|
|缺点|- 不同部署模式下信息有冗余
- 集群、分布式对于gv视图的定义需要单独定制的场景，无法满足，需要单独设计。
- GV与oracle不一致
|- 不易维护
- 不支持分布式共享集群
- 需要对视图进行分段（见下）
- 资料：需要体现两个描述
|


示例：

```
// 方案1
FvColumn gDV$InstanceCols[] = {
    FV_COLUMN_DEF("GROUP_ID", 0),
    FV_COLUMN_DEF("GROUP_NODE_ID", 1),
    FV_COLUMN_DEF("INST_ID", 2),
    FV_COLUMN_DEF("STATUS", 3),
    ...
};

// 方案2
FvColumn gDV$InstanceCols[] = {
    FV_COLUMN_DEF("INST_ID", 0),
    FV_COLUMN_DEF("STATUS", 1),
    ...
};

FvColumn gDV$InstanceCols[] = {
    FV_COLUMN_DEF("GROUP_ID", 0),
    FV_COLUMN_DEF("GROUP_NODE_ID", 1),
    ...
};

```

  


**fix_view视图命名**

- **方案1，内部以DV$视图命名，对外转成GV$同义词：**


```
#define SDT_GV_ALLOCATOR                                                                                     \
    "select userenv(\'instance\'), NAME, TOTAL_MEMORY, CURR_MEMORY_USED, FREE_MEMORY, MAX_MEMORY_USED from " \
    "x$allocator"

#define SDT_DV_INSTANCE                                                                                              \
    "select n.group_id, n.group_node_id, decode(phase,0,\'CLOSED\',1,\'STARTED\',2,\'MOUNTED\',3,\'OPEN\',4,\'OPEN " \
    "UPGRADE\',\'UNKNOWN\'),"                                                                                        \
    "i.version,startup_time,host_name,data_home,instance_number,instance_name,parallel,t.role,t.reform "             \
    "from x$instance i, x$axctopo t, x$node n"


static FixedViewDef gDstbFixedView[FV_DSTB_COUNT] = {
    GV_DEF("GV$ALLOCATOR",        Allocator    ,  SDT_GV_ALLOCATOR,      1),
    DV_DEF("GV$INSTANCE",         Instance,       SDT_DV_INSTANCE,       1),
};

```

转换同义词：

```
create or replace view dv_$instance as select * from dv$instance
/
create or replace public synonym gv$instance for dv_$instance
/
grant select on dv_$instance to select_catalog_role
/

```

问题：同义词仅对非sys用户生效，sys用户查询时按照原视图生效，因此该方案在sys用户下查gv$instance时会查内部视图gv$instance，而不是dv$instance。因此同义词和原视图名必须保持一致。

  


- **方案2，内部以GV$视图命名，需要解决内部视图同名的问题。**


```
static FixedViewDef gDstbFixedView[FV_DSTB_COUNT] = {
    GV_DEF("GV$ALLOCATOR",        Allocator    ,  SDT_GV_ALLOCATOR,      1),
    DV_DEF("DV$INSTANCE",         Instance,       SDT_DV_INSTANCE,       1),
};

```

转换同义词：

```
create or replace view dv_$instance as select * from gv$instance
/
create or replace public synonym gv$instance for dv_$instance
/
grant select on dv_$instance to select_catalog_role
/

```

对当前视图按foid进行分段，不同部署模式下，示例拉起时加载不同的视图，保证1个部署下不会加载同名视图。

```
typedef enum EnFixedObject {
    FO_NEXT_OBJECT          = 1,

    // fixed table
    FO_FIXED_TABLE_BASE            = 128,
    FO_FT_INSTANCE                 = FO_FIXED_TABLE_BASE + 0,
    FO_FT_FIXED_TABLE              = FO_FIXED_TABLE_BASE + 1,

	// local fix view
    FO_FIXED_VIEW_BASE              = 2048,
	FO_V_INSTANCE                   = FO_FIXED_VIEW_BASE + 0,

	// global fix view
	FO_LOCAL_FIXED_VIEW_BASE        = 3072,
    FO_GV_INSTANCE                  = FO_LOCAL_FIXED_VIEW_BASE + 0,

	// distribute fix view
    FO_DISTRIBUTE_VIEW_BASE         = 4096,
    FO_DV_INSTANCE                  = FO_DISTRIBUTE_VIEW_BASE + 0,

    // end
    FO_FIXED_END
}

static CodResult dcRegisterFixedViews(AnkHandler* handler)
{
    FixedObjectSet  set;
    FixedViewDef*   def;
    GetFixedViewDef getDef;

    KNL_ATTR-&gt;callbackSet.getFixedViews(&amp;set);

    for (CodUint32 i = 0; i &lt; set.count; i++) {
        if (HANDLER_CALLBACKSET-&gt;isCn() &amp;&amp; (set.decls[i].foid &gt;= FO_FIXED_VIEW_BASE &amp;&amp;  set.decls[i].foid &lt; FO_DISTRIBUTE_VIEW_BASE )) {
            continue;
        } else if (ankIsCluster(handler-&gt;kernel) &amp;&amp; set.decls[i].foid &gt;= FO_DISTRIBUTE_VIEW_BASE) {
            continue;
        }
        getDef = set.decls[i].getFvDef;
        def = getDef(set.decls[i].id);
        if (dcRegFixedView(handler, def, set.decls[i].foid) != COD_SUCCESS) {
            return COD_ERROR;
        }
    }

    return COD_SUCCESS;
}

```

#### 4.3.2 视图提供服务的阶段

NOMUNT、MOUNT、OPEN阶段提供视图服务范围汇总：    [dv视图查询范围分析](https://conf.yasdb.com/pages/viewpage.action?pageId=153017455)  

新旧方案对比：

|对比项|DV$|GV$|
|---|---|---|
|方案描述|在不同阶段按视图名加载不同的dc，在verify阶段拦截|所有相关对象（fix_table、fix_view）都在NOMOUNT阶段加载，在cursor open（execute）阶段进行拦截|
|方案对比|同一种视图的不同形态（v\dv\gv）都可定制|同一种视图的不同形态不可定制，面临以下问题：,1. 改方案以fix_table做隔离，由于集群在mount阶段就拉起网络，大部分视图提供服务的阶段都和单机保持一致，但是对于备集群来说（主实例open、备实例nomount），由于在execute阶段才进行拦截，会出现返回部分结果再报错的场景。
1. 对于分布式动态视图来说，要open之后才能提供服务，在fie_table层进行拦截无法满足要求。
|


代码示例：

```
// dv视图方案
void anrGetDynamicViews(CodUint8 phase, DynamicViewSet* set)
{
    if (phase == STARTUP_NOMOUNT) {
        set-&gt;decls = gNomountDynamicViews;
        set-&gt;count = sizeof(gNomountDynamicViews) / sizeof(DynamicViewDecl);
    } else if (phase == STARTUP_MOUNT) {
        set-&gt;decls = gMountDynamicViews;
        set-&gt;count = 0;
    } else {
        set-&gt;decls = gOpenDynamicViews;
        set-&gt;count = sizeof(gOpenDynamicViews) / sizeof(DynamicViewDecl);
    }
}

// gv视图方案
#define FT_DEF(ftName, method, ftPhase, ftVer) \
    { \
        .name = COD_TEXT_DEF(ftName), .columns = gX$##method##Cols, .columnCount = FT_COLUMN_COUNT(method), \
        .phase = ftPhase, .version = ftVer, \
        .start = x$##method##Start, .fetch = x$##method##Fetch, \
        .open = x$##method##Open, .close = x$##method##Close \
    }
static FixedTableDef gComWorkerfixedTable[FT_COM_WORKER_COUNT] = {
    FT_DEF("X$COM_WORKER", ComWorker, DATABASE_NOMOUNT, 1),
};

```

**方案：**

1. 保持fix_table阶段的拦截方案（fix_table对于sys用户可以查询）。
1. 视图方案：
    1. 按照DV视图的拦截方案，在fix_view层也进行隔离。
    1. 在非该视图提供服务的阶段，按照V$视图进行查询。


#### 4.3.3 分布式视图的查询计划

![](https://pingcode.yasdb.com/atlas/files/public/67396dcca1ad9a3311dc93b9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQWdBQUFBQUFBQVFBQUFBQkFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTE3NzYsImV4cCI6MTc4MjMyMjU3Nn0.YyympwjaojNRllGMQeAqEYDZXaw-nX-MeuAcQNmt4ag)

- 方案1：按照之前旧的分布式视图的计划先走，CN只做汇聚，保持之前的视图约束，对外只是切框架&改名。
- 方案2：所有GV视图使用一套计划
    - 和用户表关联，会走正常的计划，依赖分布式行，可能出现功能倒退，建议加约束，不允许和用户表关联
    - DV和V关联，按实际结果查询，会出现重复数据
- 方案3：针对视图展示的内容，分别定制不同的计划。


#### 4.3.4 fixed_views.sql文件改造

背景：以后部分视图内部会查系统表，有些系统表时集群&分布式特有，因此需要对fixed_views.sql中的视图按不同部署模式进行拆分

#### 4.3.5 升级&兼容性

```
#define V_DEF(fvName, method, fvText, fvVer) \
    { \
        .name = COD_TEXT_DEF(fvName), .columns = gV$##method##Cols, .columnCount = V_COLUMN_COUNT(method), \
        .isGlobal = COD_FALSE, .fullText = COD_TEXT_DEF(fvText), .version = fvVer \
    }

```

V_DEF宏中的最后一个字段表示版本，目前视图版本都为1，仅当  **更改视图结构**  时需要将该位增加1

**兼容性原则：**

1. fix_table的列可以增删修改。
1. fix_table表不能删除，只能废弃，在相关视图新增一列表明是否过时，以及显示版本号。  下来确认下权限问题。


## 5. Testcases（自测用例）

1. 用例功能与之前一致
1. 新增权限校验符合预期


## 6.资料设计章节

1. 资料中增加关于视图查询阶段的描述
1. 补充gv视图在分布式下的含义


  
