Created by 雷雨璐, last modified on 一月 23, 2024

IR链接：    [YDBRD-21595](https://jira.yasdb.com/browse/YDBRD-21595?src=confmacro)    -  LSC支持bitshuffle重排改进压缩效果  完成

##   [1. Overview（概述）](#1-overview概述)  

不同于其他以extent为单位的压缩算法，bitshuffle是以block为单位进行一种类似转置的编码后，再进行lz4压缩的算法，可以增大压缩比，提升性能。

因此针对coast 列压缩，涉及页面压缩解压与block层面的数据处理。

**支持部署形态**  ：单机列执行

##   [2. Features（功能特性）](#2-features功能特性)  

添加bitshuffle的压缩编码算法，比lz4与zstd压缩率更高，可以更好的进行向量化压缩。

##   [3. Interfaces（接口）](#3-interfaces接口)  

####   [3.1 使用bitshuffle编码压缩算法](#31-使用bitshuffle编码压缩算法)  

列新增bitshuffle压缩算法，默认将plain与dict(plain)编码类型的特定数据类型的lz4压缩列，转换为bitshuffle，转换不对外显示，外部显示仍为lz4。

特定数据类型具体包含：

NUMBER、NUMBER32、NUMBER64、NUMBER128、INT8、UINT8、INT16、UINT16、INT32、UINT32、FLOAT、DOUBLE

####   [3.2 函数接口](#32-函数接口)  

**压缩**

```
CodResult setBitShuffleCompOption(CodCompressor* compressor, CompressionType cmpType, CodUint32 level, CodUint32 bytesPerValue);

```

**解压缩**

```
CodResult setBitShuffleDecompOption(CompressionType cmpType, CodDecompressor* decompressor, CodUint32 bytesPerValue);

```

**lz4转换为bitshuffle判断接口**

```
CodBool cosSetBitshuffleType(CompressionType cmpType, StorageDataType dataType, CosCodecType codecType);

```

**解压时按类型判断bytesPerValue接口**

```
static inline CodUint32 compReturnTypeLength(StorageDataType dataType);

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

不对外感知。

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

需要区分对外行为和内部实现。

**内部实现**  ：

方案一：

调用bitshuffle动态库载入，适配压缩接口（需要在compresser结构增加元素字节数和block大小）

1. 对外感知为压缩算法compressType是bitshuffleLz4
1. 可以同时使用编码算法
1. 需要增加数据类型过滤（比如字符串不适配）
1. 用户可选


方案二：

在编码层对应数据过滤增加bitshuffle重排转置（自编码），不调用bitshuffle库，后续自动转为lz4压缩

1. 对外感知为编码算法encodeType为bitshuffle，压缩算法任意
1. 不能使用其他的编码算法
1. 过滤写在编码过滤里
1. 用户可选


方案三：

编码层后使用bitshuffle自写重排，在blockFlush时encoderClose后，extentSubmit前按block进行bitshuffle重排；读取时在extent fetch时，block解码前进行手动恢复untrans

1. 对外不感知，可以任意使用其他编码及压缩算法
1. 需要增加数据类型过滤
1. 用户不可选


方案四：

将bitshuffleLz4实现在编码层，即实现块级别的lz4压缩，后续压缩自动设为NONE，解压要手动调用lz4 decompress

1. 对外感知为编码算法为bitshuffleLz4，压缩为none。不可使用其他压缩及编码算法
1. 数据类型过滤使用编码过滤
1. 用户可选


**对外感知**  ：

||压缩类型|编码类型|用户可选性|
|---|---|---|---|
|方案一|bitshuffleLz4|all|可选|
|方案二|all|bitshuffle|可选|
|方案三|all|all|不可选|
|方案四|none|bitshuffleLz4|可选|


**方案一**  ：将bitshuffle按库接口对接并动态导入在compresser、decompresser结构增加：元素字节bytesPerValue、block大小maxCountPerBlock，以对接接口。

涉及  **压缩**  的接口有：

cosCreateCompressor：热转冷和直导

- compCreateWriter ：xfmrPrepareInsert （热转冷）和 spfRgdInitCoralInsertCtx（直接导入稳态）和 aColPrepareInsert（AC查询）
- compDupWriter：同上。用于layout_column 和 layout_slice


codInitCompressor：

- compressBlock 表空间透明压缩调用（设为0）
- cosMemEvictCallback 支持磁盘缓存，内存驱逐回调 （感觉可以回调）
- bakAllocWorker 备份恢复 （设为0）


```
typedef struct StCodCompressor {
    CodUint32             bytesPerValue;
    CodUint32             maxCountPerBlock;
} CodCompressor;

typedef struct StCosCompWriteOptions {
    CodUint32             bytesPerValue;
    CodUint32             maxCountPerBlock;
} CosCompWriteOptions;

CosCompWriteOptions compCtx = {
        .bytesPerValue = columns-&gt;columnInfos-&gt;typeInfo.bytesPerValue,
        .maxCountPerBlock = writerCfg-&gt;maxBlkRowNum,
    };

```

在sliceCreateWriter中初始化compWriter时通过sliceColumn返回bytesPerValue，通过slice create cfg上的writercfg返回maxCountPerBlock。

![](https://pingcode.yasdb.com/atlas/files/public/67396c5f8970c2af4f520b81/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFRQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA0OTAsImV4cCI6MTc4MjMxMTI5MH0.a1Cgdh-Q5-8D53QRFjshLAwivz7QAx1XAN5BoDYRHXk)

涉及  **解压**  的接口有：

- compDecompressData
    - compReadData 表空间透明解压 （可以回调，用decompressBlock里面的）
    - compMinerReadData：miner dump
    - packReaderBufferRead read object
        - packReaderLoadPackPartial & 
        - packReaderLoadUncached -> 预读 / fetch时coral读取slice需要columnGetExtendReadAssist ，coralSwitchSlice时需要resetReader
    - packReaderCacheRead ：packReaderLoadObject 同上
- sliceGetCompData 主备发送线程需要ssndSendItem 
- decompressBlock 表空间透明解压调用（设为0）
- rstInitWorkerDecompress 增量备份，回滚


```
typedef struct StCodDecompressor {
    CodUint32          bytesPerValue;
    CodUint32          maxCountPerBlock;
} CodDecompressor;

typedef struct StCosObjectInfo {
    CodUint32       bytesPerValue;
    CodUint32       maxCountPerBlock;
} CosObjectInfo;

```

在cosCreateFileReader中找不到如何挂载bytesPerValue和maxCountPerValue的地方，可以先传0，在getBlockValue中load ObjectPack的时候再进行上下文的传入，

因为getpack以后才会对获取到的extent进行block层面的解码，不影响解码结果。

接口对接使用当前动态载入框架，编写Makefile生成libbitshuffle.so并适配。

**方案四**  ：按bitshuffle原理重新规划，拆开bitshuffle.c中的bshuf_compress_lz4_block函数不动用之前的压缩接口，如果设置是bitshuffle，直接将压缩设为NONE，在编码解码部分进行块级别的bitshuffle调用（这里需要在编码结构建立前编写块数据的位转置），手动调用lz4；

解压时也要手动调用decompress lz4和转置恢复。



优势：接口更好对接，且后续向量化实现更容易

劣势：编码复杂度变高，编码层调用lz4可能存在耦合问题

##   [**最终选择：不对外感知的方案一**](#最终选择不对外感知的方案一)  

即：

||压缩类型|编码类型|用户可选性|
|---|---|---|---|
|方案一|bitshuffleLz4|plain/dict_plain|不可选|


内部增加新CompressionType为COMPRESSION_BITSHUFFLE，视图上不对外感知。用户不可设定。

同时在不使用编码的情况下才会自动调用bitshuffle。

**压缩层：**

在columnWriter层进行bitshuffle的判断，只针对data进行bitshuffle，meta仍使用lz4。同时由于数据分布影响，layout方式为silo或column才会进行bitshuffle。

通过setBitShuffleCompOption接口进行bytesPerValue的赋值，以对应bitshuffle库接口。如果已进行bitshuffle，对应的压缩类型在内部即变为COMPRESSION_BITSHUFFLE。

**解压层：**

在columnReader层读取数据文件的压缩类型，如果为COMPRESSION_BITSHUFFLE，则调用setBitShuffleDecompOption接口，根据dataType进行bytesPerValue的计算。

```
typedef struct StCosCompWriteOptions {
    CodUint32             bytesPerValue;
} CosCompWriteOptions;

typedef struct StCosObjectInfo {
    CodUint32       bytesPerValue;
} CosObjectInfo;

```

对应bitshuffle的库使用动态链接方式，源代码：    [bitshuffle(Gitlab)](https://git.yasdb.com/leiyulu/bitshuffle)  

通过CMakeLists进行各个平台的so文件生成。

###   [5.3 Abnormal Situation（异常情况）](#53-abnormal-situation异常情况)  

1. inLen / bytesPerValue 除不尽
1. inLen < bytesPerValue 情况


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

性能测试结果：    [bitshuffle性能测试](https://conf.yasdb.com/pages/viewpage.action?pageId=133584683)  

ut 增加压缩类型测试。

regress 增加压缩测试用例。

端到端验证编码压缩类型生效。

##   [7.资料设计章节](#7资料设计章节)  

  [YDBRD-21594: Encoding Algorithm Research（编码算法特性调研）](https://conf.yasdb.com/pages/viewpage.action?pageId=133564338)  

  [lsc写入读取源码整理](https://conf.yasdb.com/pages/viewpage.action?pageId=133591791)  

  [【Spearfish】LSC表导入不走VGD方案设计](https://conf.yasdb.com/pages/viewpage.action?pageId=81297621)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

## Attachments:

[image2023-11-8_19-12-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWU4OTcwYzJhZjRmNTIwYjdmIiwicmVmX2lkIjoiNjczOTZjNWU3MjgyMDZlZmI5MmYxMTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNDkwLCJleHAiOjE3ODIzODY4OTB9.WFsBT5w3ckmghV_Hj7I1ejnLzQCEs9-ApklQPBHTJPk)

 (image/png)    


[image2023-12-12_17-19-30.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNWY4OTcwYzJhZjRmNTIwYjgwIiwicmVmX2lkIjoiNjczOTZjNWU3MjgyMDZlZmI5MmYxMTc2IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNDkwLCJleHAiOjE3ODIzODY4OTB9.H15aPVaNpbbWe_IoiNiNQf_FjL8qg2Bvg8bSFXZXLHk)

 (image/png)    


## Comments:

|  [](null)  ,1、选择不对外感知的方案一,2、类型过滤明确哪些类型（数值）,3、调研starRock实现方式,4、数据长度、不同指令集对性能的影响,5、与其他压缩算法性能对比,Posted by leiyulu at 十一月 10, 2023 15:00|
|---|
