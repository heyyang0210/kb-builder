Created by 刘亮杰 on 一月 18, 2024

#   [YDBRD-13070: c驱动支持内存注入管理](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#ydbrd-xxxx--xxx-designxxx%E6%96%B9%E6%A1%88%E8%AE%BE%E8%AE%A1)  

SR：    [YDBRD-13070](https://jira.yasdb.com/browse/YDBRD-13070?src=confmacro)    -  【驱动】c驱动支持内存注入管理  完成

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#1-overview%E6%A6%82%E8%BF%B0)  

需求来源：产品化需求

场景：C驱动支持内存管理

需求描述： C驱动支持内存管理

需求范围：单机

功能概要：支持C驱动使用外部内存管理，支持malloc、realloc、free使用用户回调函数+用户内存管理上下文，以支撑内存注入

OCI中存在此类功能：    [Connect, Authorize, and Initialize Functions (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/lnoci/connect-authorize-and-initialize-functions.html#GUID-16BDA1F1-7DAF-41CA-9EE1-C9A4CB467244)  

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

支持C驱动使用外部内存管理，支持malloc、realloc、free使用用户回调函数+用户内存管理上下文，以支撑内存注入。

  [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#3-interfaces%E6%8E%A5%E5%8F%A3)  

```
/* YACLI mem callbacks */
typedef YacPointer (*YacMalocFunc)(YacPointer ctxp, size_t size);
typedef YacPointer (*YacRalocFunc)(YacPointer ctxp, YacPointer memptr, size_t newSize);
typedef YacVoid (*YacMfreeFunc)(YacPointer ctxp, YacPointer memptr);

YacResult yacAllocEnvWithMemCb(YacHandle* env, YacPointer ctxp, YacMalocFunc malocFp, YacRalocFunc ralocFp, YacMfreeFunc mfreeFp);
```

yacAllocEnvWithMemCb在Yac环境中创建带有内存回调的环境，根据传入的回调函数情况，创建Yac环境并设置相应的内存回调函数，返回创建结果。参数：

- `env`: Yac环境句柄的指针
-  `ctxp`: 上下文指针
-  `malocFp`: 内存分配回调函数
-  `ralocFp`: 内存重新分配回调函数
-  `mfreeFp`: 内存释放回调函数


  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

1. 新增yacAlloc、yacFree、yacExtend、yacAllocCb、yacFreeCb、yacAllocEnvWithMemCb，用于执行内存分配和释放操作，以及创建带有内存回调的环境，同时也支持使用内存回调函数。
    1. yacAlloc(YacEnv* env, YacUint32 size, YacPointer* ptr)分配内存。    
  - 参数：    
  - `env`: Yac环境指针    
  - `size`: 要分配的内存大小    
  - `ptr`: 分配的内存指针将存储在此处    
  - 如果Yac环境中的`malocFp`函数为空，则调用`codSysAlloc`来分配内存。否则，使用Yac环境中的`malocFp`函数分配内存。
    1.  `yacFree(YacEnv* env, YacPointer ptr)`释放内存。    
  - 参数：    
  - `env`: Yac环境指针    
  - `ptr`: 要释放的内存指针    
  - 如果Yac环境中的`mfreeFp`函数为空，则使用`codSysFree`来释放内存。否则，使用Yac环境中的`mfreeFp`函数释放内存。
    1. `yacExtend(YacEnv* env, YacPointer oldPtr, YacUint32 oldSize, YacUint32 newSize, YacPointer* newPtr)`    
  - 在Yac环境中重新分配（扩展/缩小）内存。    
  - 参数：    
  - `env`: Yac环境指针    
  - `oldPtr`: 要重新分配的旧内存指针    
  - `oldSize`: 旧内存大小    
  - `newSize`: 新内存大小    
  - `newPtr`: 新分配的内存指针将存储在此处    
  - 如果Yac环境中的`ralocFp`函数为空，则调用`codSysExtend`来重新分配内存。否则，使用Yac环境中的`ralocFp`函数重新分配内存。
    1. `yacAllocCb(YacPointer ctxp, YacUint32 size, YacPointer* ptr)`使用内存回调函数分配内存。    
  - 参数：    
  - `ctxp`: 上下文指针    
  - `size`: 要分配的内存大小    
  - `ptr`: 分配的内存指针将存储在此处    
  - 根据回调函数情况，调用`codSysAlloc`或回调函数进行内存分配。
    1. `yacFreeCb(YacPointer ctxp, YacPointer ptr)`使用内存回调函数释放内存。    
  - 参数：    
  - `ctxp`: 上下文指针    
  - `ptr`: 要释放的内存指针    
  - 根据回调函数情况，调用`codSysFree`或回调函数进行内存释放。
1. objArrayFreeWithCb、objArrayCreateWithCb、objArrayInitWithCb、 objArrayInitByExtentWithCb、objArrayDestroyWithCb，用于销毁在代码中创建的各种对象以及相应的内存，以便在不再需要这些对象时释放资源。
1. listCreateWithCb、listCreate2WithCb、listDestroyWithCb函数，用于实现动态数组列表的创建、销毁和管理。
1. 设置新的错误码。


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

```
static YacPointer testYacMalocFunc(YacPointer ctxp, size_t size)
{
    YacUint32* memCtx = (YacUint32*)ctxp;
    COD_ASSERT(*memCtx == 1);
    YacPointer buf = malloc(size);
    return buf;
}

static YacPointer testYacRalocFunc(YacPointer ctxp, YacPointer memptr, size_t newSize)
{
    YacUint32* memCtx = (YacUint32*)ctxp;
    COD_ASSERT(*memCtx == 1);
    YacPointer buf = realloc(memptr, newSize);
    return buf;
}

static YacVoid testYacMfreeFunc(YacPointer ctxp, YacPointer memptr)
{
    YacUint32* memCtx = (YacUint32*)ctxp;
    COD_ASSERT(*memCtx == 1);
    free(memptr);
}

TEST_F(TestYacDriverBase, testYacMemCallback)
{
    YacUint32 memCtx = 1;

    YacHandle env = NULL;
    YacHandle conn = NULL;
    YacHandle stmt = NULL;
    YAC_EXPECT_CALL(yacAllocEnvWithMemCb(&env, &memCtx, testYacMalocFunc, testYacRalocFunc, testYacMfreeFunc));
    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_DBC, env, &conn));
    YAC_EXPECT_CALL(yacConnect(conn, gSrvStr, YAC_NULL_TERM_STR, user, YAC_NULL_TERM_STR, pwd, YAC_NULL_TERM_STR));

    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_STMT, conn, &stmt));
    YAC_EXPECT_CALL(yacDirectExecute(stmt, "select 1 from dual", YAC_NULL_TERM_STR));
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt));

    yacDisconnect(conn);
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_DBC, conn));
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_ENV, env));
}

typedef struct StMemCb {
    YacChar*  buf;
    YacUint32 bufSize;
    YacUint32 offset;
} MemCb;

static YacPointer testYacMalocFunc2(YacPointer ctxp, size_t size)
{
    MemCb* memCtx = (MemCb*)ctxp;
    if (size > memCtx->bufSize - memCtx->offset) {
        return NULL;
    }
    YacPointer buf = memCtx->buf + memCtx->offset;
    memCtx->offset += size;
    return buf;
}

static YacPointer testYacRalocFunc2(YacPointer ctxp, YacPointer memptr, size_t newSize)
{
    MemCb* memCtx = (MemCb*)ctxp;
    if (newSize < memCtx->bufSize - memCtx->offset) {
        return NULL;
    }
    YacPointer buf = memCtx->buf + memCtx->offset;
    memCtx->offset += newSize;
    return buf;
}

static YacVoid testYacMfreeFunc2(YacPointer ctxp, YacPointer memptr)
{
    return;
}

TEST_F(TestYacDriverBase, testYacMemCallback2)
{
    MemCb memCb;
    memCb.buf = (YacChar*)malloc(10 << 20);
    COD_ASSERT(memCb.buf != NULL);
    memCb.bufSize = 10 << 20;
    memCb.offset = 0;

    YacHandle env = NULL;
    YacHandle conn = NULL;
    YacHandle stmt = NULL;
    YAC_EXPECT_CALL(yacAllocEnvWithMemCb(&env, &memCb, testYacMalocFunc2, testYacRalocFunc2, testYacMfreeFunc2));
    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_DBC, env, &conn));
    YAC_EXPECT_CALL(yacConnect(conn, gSrvStr, YAC_NULL_TERM_STR, user, YAC_NULL_TERM_STR, pwd, YAC_NULL_TERM_STR));

    YAC_EXPECT_CALL(yacAllocHandle(YAC_HANDLE_STMT, conn, &stmt));
    YAC_EXPECT_CALL(yacDirectExecute(stmt, "select 1 from dual", YAC_NULL_TERM_STR));
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_STMT, stmt));

    yacDisconnect(conn);
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_DBC, conn));
    YAC_EXPECT_CALL(yacFreeHandle(YAC_HANDLE_ENV, env));

    free(memCb.buf);
}
```

  


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=127635843#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*