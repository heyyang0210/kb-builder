Created by 雷雨璐, last modified on 三月 19, 2024

IR链接：    [YDBRD-21592](https://jira.yasdb.com/browse/YDBRD-21592?src=confmacro)    -  LSC支持自适应编码  完成

  


##   [1. Overview（概述）](#1-overview概述)  

为了便于客户针对不同的数据类型进行编码方式的选择，针对coast列压缩，在转换过程中自适应地探测合适的编码方式，对同一列在不同数据块中支持使用不同的算法来进行编码。

##   [2. Features（功能特性）](#2-features功能特性)  

添加针对不同编码的自适应策略。自适应后，可自动根据数据类型，以及特征进行编码类型的选取。

##   [3. Interfaces（接口）](#3-interfaces接口)  

###   [3.1 使用自适应编码算法](#31-使用自适应编码算法)  

deltax，rle，前缀，字符串delta等不跨block的编码采用写入时block内自适应策略。

字典编码采用临时的小字典，以及现有的字典已满回退接口，查看并预测重复比进行退化。

###   [3.2 对外显示](#32-对外显示)  

增加新的编码枚举AUTO。非LSC表默认编码视图显示unknown，不进行编码。LSC表默认编码原视图显示plain，不进行编码；现改为默认视图显示AUTO，进行自适应编码，内部自行根据数据类型及特征进行编码选择。

用户不可指定AUTO编码。

###   [3.3 函数接口](#33-函数接口)  

结构体定义：

```
typedef struct StAutoEncoder {
    CosEncoderHead  head;
    CosTypeInfo*    typeInfo;
    CosMemSlice*    values;
    CosMemSlice*    offsets;
    CodUint8*       extraBuf;
    CosMemOwner*    owner;
    CodUint32       valueCount;
} AutoEncoder;

```

1、在cos_encoder.c中添加接口与数据cache，进行编码自适应

```
// cos_encoder.c
static CodResult encoderOpenAuto(CosEvAllocator* evAllocator, const CosTypeInfo* typeInfo, CodUint32 maxCountPerBlock,
                                 CosEncoder** encoder)

```

这里在    `encoderOpenAuto()`    函数中进行缓存的内存分配（按maxCountPerBlock）。

同时    `pfnWriteFixedValue()`    函数中调用autoWriteValue。后续在数据写入中进行按特征值选择另外的编码。

  `autoWriteValues()`    写入时直接写入缓存。

```
// cos_encoder.c
static CodResult autoWriteValues(CosEvAllocator* evAllocator, const CosTypeInfo* typeInfo, CodUint32 maxCountPerBlock,
                                 CosEncoder** encoder)

```

在    `autoCloseEncoder()`    中进行特征值的计算，同时根据结果进行数据编码encoder的生成及写入。encoder缓存设置为满一个block大小开始统计特征值。

```
CodVoid autoCloseEncoder(CosEncoderHead* encodeImpl)

```

2、在cos_dictencode.c处使用字典回退接口进行字典自适应。

```
//cos_dictencode.c
dictWriteFixedValue(CosEncoderHead* encodeImpl, CodUint8* value, CodBool* isFull)
{
    // 在这里获取aux.totalCount为数据总数，和index为distinct值
    // 如果数据量小于4K，进行plain编码与小字典的写入，重复率大于50%时整个slice退化为plain，小于50%生成新的大字典
    // 否则进行检查，重复率不到50%退化
    // 数据量越大，回退百分比越小；百分比使用类反函数进行计算
    // null值单独计算
    // 回退则调用：
    if (dictRevertToPlain(dict) != COD_SUCCESS) {
        return COD_ERROR;
    }
    return plainWriteFixedValue(dict-&gt;plainEncoder, value, isFull);
}

```

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

####   [自适应方案层级选择](#自适应方案层级选择)  

**方案一：**

按列进行编码选择，即只根据数据类型进行编码判断

在    `ankCoastTransferColumnDef()`    函数中直接按dataType转换编码。

**方案二：**

按block块进行编码选择，即按数据特征进行特征统计，判断编码算法

采用在    `blockFlush()`    阶段进行重编码，取压缩之前的result解码并根据计算的特征重新编码，同时更新meta相关的编码。

需要将已编码的数据重新解码生成源数据，再使用源数据生成一个新的encoder写入，当前encoder的写入都会写入该新encoder。

**方案三”：**

考虑在    `blockWriteVarValues()`    或    `blockWriteFixedValues()`    处写一个新函数，通过slice传入的    `dataSet->columnValues[i]`    和    `dataSet->valueNum`    数据，在    `encoderWriteValues()`    之前写一个小的列级缓存（函数传递到block层级），在列级缓存中进行特征值的统计。

【这个列级缓存里可以做自适应后续的兼容处理，提供各种特征统计接口】

使用    `BlockWriter->maxCountPerBlock`    进行数值块的划分，按块进行统计，同时统计完根据结果更新    `BlockWriter->encoder`    中使用的编码算法。（这里需要判断，如果编码为plain/auto才进行更改）

数据类型等都可以在    `BlockWriter->columnInfo->typeInfo`    中获取。

自适应完成后将进行    `encoderWriteVarValues()`    ，即写入resetEncoder。

#   [！！最终方案：](#最终方案)  

选取方案三。

##   [一、integer、number等采用写入时block内自适应](#一integernumber等采用写入时block内自适应)  

在block缓存中进行判断，为真则在写入encoder之前，进行encoder的重新open。

**cos_encoder.c增加接口：**

  `encoderOpen()`    实现逻辑：

传入参数evallocator、typeInfo（数据特征）、maxCountPerBlock（block值数）、encoder

- 在函数中给AutoEncoder结构的缓存申请内存
- 其余内存申请按正常encoder逻辑走


  `autoWriteValue()`    实现逻辑：

传入参数：evallocator、typeInfo、maxCountPerBlock、writerImp->encoder->impl（encoder）。

将传入的数据直接写入缓存中。

  `autoCloseEncoder()`    实现逻辑：传入参数：writerImp->encoder->impl（encoder）evAllocator、maxCountPerBlock等可以从encoder上获取。

处理逻辑：利用缓存中的数据，与encoder中的datatype，针对不同的数据类型进行特征值计算，得到要使用的codecType，再open encoder并整个block写入到encoder。

##   [二、char、varchar等采用原有框架进行字典编码选择](#二charvarchar等采用原有框架进行字典编码选择)  

自适应编码对于char、varchar类型，会基于重复度进行dictionary(rle)与plain类型的选择。

**cos_dictencode.c增加接口:**

通过前4K的数据来预测后面是不是使用字典。在    `cosPutDictionaryData()`    后使用得到的aux.valueCount（数据总数）和index（distinct值）来计算需要回退的百分比值。

如果写入过程中后续使用字典，但index达到一定数量，则不使用字典编码方案。

回退直接调用    `dictRevertToPlain()`    接口。

###   [具体规则：](#具体规则)  

- 写入值不超过4K
    - 用plain编码。无字典写入内存
- 写入值超过4K
-     1. 当写入值数量<=4K时，全部使用plain编码，同时内部会生成不对外的小字典进行重复度的统计。（小字典统计完会销毁）
        1. 如果前4K重复度小于2K，则会重新生成一个大字典，并且4K之后的block初始编码类型为字典编码；
        1. 如果前4K重复度大于等于2K，则后续的整个slice都使用plain编码。
    1. 当写入值数量>4K时
        1. 前4K情况满足A: 小字典销毁，初始使用字典编码，会按照  **实时的block内重复度统计**  （具体见下）进行block级别的回退。
        1. 前4K情况满足B: 整个slice都用plain编码，字典销毁。



miner统计：blockMeta为block内实际使用的编码类型；columnMeta一般显示为CODEC_DICT, 但是会在情况B或者写入值不超过4K的时候显示为DICT_PLAIN.

```
#define COS_MAX_DICT_UNIQUE_VALUE KB(300)    // 大字典大小
#define COS_MAX_FIRSTBLOCK_DICT_UNIQUE_VALUE KB(2)    // 小字典的重复度边界
#define SMALLTABLE_DICT_REVERT_SIZE KB(4)	 // 小字典大小
#define AUTO_DICT_CHECKNUM 1				// 是否进行小字典生成

```

##   [实时的block内重复度特征统计方式](#实时的block内重复度特征统计方式)  

  [自适应编码特征选取测试](https://conf.yasdb.com/pages/viewpage.action?pageId=141577888)  

特征统计通过预计算一个代价公式，算出使用编码后的压缩效果，并与测试时确定的配置阈值进行对比，达到阈值即选择算法。

#####   [一、integer等数值型数据](#一integer等数值型数据)  

数值型可使用的编码算法有bitshuffle-plain、rle、字典编码。这里根据性能不考虑字典编码。

每列的标题值表示【随机数的值域】。

|.bin(KB) + .meta(KB)|0~2^11|0~2^12|0~2^13|0~2^14|0~2^15|0~2^16|0~2^17|0~2^18|备注|
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
|bitshuffle|40|58|85|132|191|270|395|524|master|
|rle+bitshuffle|11|16|26|42|70|186|1447|2226|master + plain/rle都可bitshuffle|
|rle|18|27|44|78|144|287|1186|2181|master|


横轴表示，位数为11-16的值域范围，不同算法所得到的相对压缩大小。

纵轴表示，最终压缩后的.bin(KB) + .meta(KB)值。

![](https://conf.yasdb.com/download/attachments/141577888/image2024-2-23_14-44-54.png?version=1&modificationDate=1708670695000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFnQUFnQkFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQWlBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBSUFBQUFBZ0FBQUFBQUFBQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MjIsImV4cCI6MTc4MjMxMTQyMn0.WryahlI1N2inNyMqtp1XC98oQ3GpsnwPJ6dGv_KFupg)

综上：

数据最大值的二进制位数在17以下的，rle+bitshuffle效果比bitshuffle好；

数据最大值的二进制位数在16以下的，rle效果比bitshuffle好；

数据最大值的二进制位数在17以下的，rle+bitshuffle效果也比rle好。

蓝色表示rle+bitshuffle效果比bitshuffle好。

因此，设置统计结果为：

当  **最大值小于2**  **17**  **时**  ，设置使用rle进行编码；

~~当~~  ~~**最大值大于2**~~  ~~**17**~~  ~~**，且值域范围小于2**~~  ~~**17**~~  ~~**时**~~  ~~，结合使用预计算代价公式进行判断，通过计算重复权重生成一个估算结果，结果满足一定阈值则也使用rle进行编码。~~

~~**代价公式：**~~

~~计算所有数值的重复权重，如果重复权重大于95%，则使用rle。~~

#####   [二、number型数据](#二number型数据)  

number型数据可使用的编码算法有bitshuffle-plain、byte-packet。

设置代价公式进行判断，满足一定阈值使用byte-packet进行编码。

**代价公式：**

计算出所有数值的最大位宽，如果该位宽值小于等于7，则使用byte-packet。

|.bin(KB) + .meta(KB)|0~2^5|0~2^6|0~2^7|0~2^8|0~2^9|0~2^10|0~2^11|备注|
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---|
|byte-packed|11|13|15|16|18|22|28|master|
|byte-packed+bitshuffle|18|24|36|55|84|192|390|master + plain/byte-packed都可bitshuffle|
|bitshuffle|36|37|40|43|48|59|83|master|


横轴表示，位数为11-16的值域范围，不同算法所得到的相对压缩大小。

纵轴表示，最终压缩后的.bin(KB) + .meta(KB)值。

综上：

数据最大值的二进制位数在7以下的，byte-packed+bitshuffle效果比bitshuffle好；

byte-packed效果比bitshuffle好；

byte-packed效果比byte-packed+bitshuffle好。

![](https://pingcode.yasdb.com/atlas/files/public/67396c668970c2af4f520be4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFnQUFnQkFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQWlBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBSUFBQUFBZ0FBQUFBQUFBQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MjIsImV4cCI6MTc4MjMxMTQyMn0.WryahlI1N2inNyMqtp1XC98oQ3GpsnwPJ6dGv_KFupg)

```
// Compare the bit width values corresponding to the maximum value under different encoding algorithms
#define ENCODER_AUTORLE_BITWIDTH_DIVIDINGLINE 16
#define ENCODER_AUTONUMBER_BITWIDTH_DIVIDINGLINE 7

```

#####   [三、char、varchar等字符型数据](#三charvarchar等字符型数据)  

字符型数据可使用的编码算法有plain、字典编码。

测试使用随机生成的char(1)型字符进行压缩，

**压缩效果**  ：DICTIONARY(RLE) 比 plain 好

**查询效果**  ：plain 比 DICTIONARY(RLE) 好

  


随机生成大小为char(1)的字符，并复制到另一个表中。

|1024000行|.BIN + .META|DECOMPRESS BYTES|SCOL DECOMPRESS TIME|SELECT COUNT()|
|:---:|:---:|:---:|:---:|:---:|
|plain|8KB|1049210|670 -  0 = 670|00.095|
|dictionary(rle)|6KB|28798|709 - 670= 39|00.118|


暂时先按dict进行编码。

  


之前字典编码的回退阈值为，大于0xFFFFFFFF（即2  32  ）则回退。

现改为如果cache中得到的基数/总数大于特定比率，则自动回退为字典编码。

**代价公式：**

使用对数拟合，函数式

![](https://pingcode.yasdb.com/atlas/files/public/67396c668970c2af4f520be6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFnQUFnQkFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQWlBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBSUFBQUFBZ0FBQUFBQUFBQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MjIsImV4cCI6MTc4MjMxMTQyMn0.WryahlI1N2inNyMqtp1XC98oQ3GpsnwPJ6dGv_KFupg)

，拟合结果 a = 0.6，b = -0.07213475204，可决系数 R  2   = 1

![](https://conf.yasdb.com/download/attachments/138548361/image2024-1-16_21-37-21.png?version=1&modificationDate=1705412241000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFnQUFnQkFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQWlBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBSUFBQUFBZ0FBQUFBQUFBQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MjIsImV4cCI6MTc4MjMxMTQyMn0.WryahlI1N2inNyMqtp1XC98oQ3GpsnwPJ6dGv_KFupg)

  
    


使用线性拟合，函数式

![](https://pingcode.yasdb.com/atlas/files/public/67396c66a1ad9a3311dc8a53/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFnQUFnQkFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQWlBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBSUFBQUFBZ0FBQUFBQUFBQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MjIsImV4cCI6MTc4MjMxMTQyMn0.WryahlI1N2inNyMqtp1XC98oQ3GpsnwPJ6dGv_KFupg)

，拟合结果 a = -0.0017857142857，b = 0.45，可决系数 R  2   = 0.82040816

  
    


![](https://conf.yasdb.com/download/attachments/138548361/image2024-1-16_21-37-43.png?version=1&modificationDate=1705412264000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFnQUFnQkFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQWlBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBSUFBQUFBZ0FBQUFBQUFBQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MjIsImV4cCI6MTc4MjMxMTQyMn0.WryahlI1N2inNyMqtp1XC98oQ3GpsnwPJ6dGv_KFupg)

  


拟合点如下：

|  
|  
|  
|  
|  
|  
|  
|
|---|---|---|---|---|---|---|
|x|4|8|16|32|64|128|
|y|0.5|0.45|0.4|0.35|0.3|0.25|


**选择对数拟合**

对数拟合效果：

![](https://pingcode.yasdb.com/atlas/files/public/67396c668970c2af4f520be7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiRUFBQUFBQUFBQUFBQUFBQUFBQUFBQWhBQUFFQUFnQUFnQkFDQUFBQUFBQUFBQUFBQkFBQUFBQUFBQUFBQWlBQUFBSUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBQUFFQUFBSUFBQUFBZ0FBQUFBQUFBQUFBQUFCQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA2MjIsImV4cCI6MTc4MjMxMTQyMn0.WryahlI1N2inNyMqtp1XC98oQ3GpsnwPJ6dGv_KFupg)

最后达到小于等于20%时，函数直接收敛为平行于x轴的直线。即大于20%进行退化。

```
#define DICT_REVERT_CALCRATE_PARAM_A 0.6
#define DICT_REVERT_CALCRATE_PARAM_B -0.07213475204

```

#####   [四、TINYINT/SMALLINT/大对象型数据](#四tinyintsmallint大对象型数据)  

直接使用plain编码。

  `values->vector.data + begin * values->bytesPerValue`  

**后续特征：**

（平均）差值、最大公约数（用在delta）

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

- 注意后续增加新的编码算法的兼容性。
- 自适应计算仅针对传入存储底层的数据来做出判断，如一般slice会增加排序，导致实际编码顺序与insert顺序不一致，自适应选择的计算也会因此产生差异。


如：以下2个数据插入场景，数据分布是一样的，编码不一样

```
create table ydbrd21592_t01(c1 varchar(5000)) organization lsc tablespace users;
// 场景一(以下走的字典编码)
    declare 
      begin
       for i in 1 .. 20000 loop
         insert into ydbrd21592_t01 values(concat('abc',i));
         if i%10000=0 then
           commit;
         end if;
       end loop;
      end;
	/

    declare 
      begin
       for i in 1 .. 3686 loop
         insert into ydbrd21592_t01 values('abc');
         if i%10000=0 then
           commit;
         end if;
       end loop;
      end;
	/
alter table ydbrd21592_t01 alter slice all stable;
alter system checkpoint;

```

先编码3686个abc，再编码20000个abci

```
// 场景二(以下走的plain编码)
    declare 
      begin
       for i in 1 .. 20000 loop
         insert into ydbrd21592_t01 values(concat('abc',i));
         if i%10000=0 then
           commit;
         end if;
       end loop;
      end;
	/

    declare 
      begin
       for i in 1 .. 3686 loop
         insert into ydbrd21592_t01 values('bbc');
         if i%10000=0 then
           commit;
         end if;
       end loop;
      end;
	/
alter table ydbrd21592_t01 alter slice all stable;
alter system checkpoint;

```

先编码20000个abci，再编码3686个bbc（b排序在a之后）

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 针对数值型、字符型、number型分别测试基本功能
1. 针对不同特征选择的阈值进行测试，看能否自动转换
1. 对于删除的字典回退进行兼容性测试
1. 添加ut、regress用例


##   [7.资料设计章节](#7资料设计章节)  

  [YDBRD-21594: Encoding Algorithm Research（编码算法特性调研）](https://conf.yasdb.com/pages/viewpage.action?pageId=133564338)  

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

代价公式可以进行优化，或者使用类DNN模型，利用压缩后每个block的压缩率进行代价公式的自优化。

## Attachments:

[image2023-12-11_18-0-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjU4OTcwYzJhZjRmNTIwYmRlIiwicmVmX2lkIjoiNjczOTZjNjU3MjgyMDZlZmI5MmYxMWMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjIyLCJleHAiOjE3ODIzODcwMjJ9.za86beu5FkItdhWJmG_MbrFT5zUK9jmLhvEK4eJvGiU)

 (image/png)    


[image2024-1-12_11-42-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjVhMWFkOWEzMzExZGM4YTRjIiwicmVmX2lkIjoiNjczOTZjNjU3MjgyMDZlZmI5MmYxMWMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjIyLCJleHAiOjE3ODIzODcwMjJ9.y-OiNy3tCrCuElHvEIolsp0N-GlGb84ldPtH_yDdpLY)

 (image/png)    


[image2024-1-12_15-19-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjVhMWFkOWEzMzExZGM4YTRkIiwicmVmX2lkIjoiNjczOTZjNjU3MjgyMDZlZmI5MmYxMWMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjIyLCJleHAiOjE3ODIzODcwMjJ9.YcN-ISH2_WHrJ9GIvwFgvcmsjmNxfojE7mgcAVoCm3M)

 (image/png)    


[image2024-1-16_16-7-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjU4OTcwYzJhZjRmNTIwYmRmIiwicmVmX2lkIjoiNjczOTZjNjU3MjgyMDZlZmI5MmYxMWMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjIyLCJleHAiOjE3ODIzODcwMjJ9.OuVdVcf9UOgY-VUdHUpucgMuUj3VfpsIFGTZSK_AaRY)

 (image/png)    


[image2024-1-16_21-37-21.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjVhMWFkOWEzMzExZGM4YTRlIiwicmVmX2lkIjoiNjczOTZjNjU3MjgyMDZlZmI5MmYxMWMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjIyLCJleHAiOjE3ODIzODcwMjJ9.y5gJ18F3bN_GhCpCFm9VPTqVs2BfgC3GG5_SohfSZw4)

 (image/png)    


[image2024-1-16_21-37-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjVhMWFkOWEzMzExZGM4YTRmIiwicmVmX2lkIjoiNjczOTZjNjU3MjgyMDZlZmI5MmYxMWMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjIyLCJleHAiOjE3ODIzODcwMjJ9.-AlCzPZ5ONPvODgpEhiZqBJNY_D4AUXbfPJ5KOB8Pg4)

 (image/png)    


[image2024-1-17_10-25-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjVhMWFkOWEzMzExZGM4YTUxIiwicmVmX2lkIjoiNjczOTZjNjU3MjgyMDZlZmI5MmYxMWMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjIyLCJleHAiOjE3ODIzODcwMjJ9.56ua8vf3mLGuOTGBKyawfMUB8-OwDZS-q9SmjTg5dtQ)

 (image/png)    


[image2024-2-23_14-44-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjVhMWFkOWEzMzExZGM4YTUyIiwicmVmX2lkIjoiNjczOTZjNjU3MjgyMDZlZmI5MmYxMWMyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNjIyLCJleHAiOjE3ODIzODcwMjJ9.bANe4lZjLcV0mbProCO92cq8m--YSNrDe_wTCYj4Q5Y)

 (image/png)    


## Comments:

|  [](null)  ,2024.1.10 讨论纪要：,1、新加一个编码枚举AUTO，非LSC表默认编码类型为unknown，LSC表默认编码类型为plain，修改为auto。指定plain类型时为plain。对外视图上显示auto。评审时讨论是否用户可以指定auto。,2、测试rle使用场景（与bitshuffle对比），平均run-length、有负值时不能使用bitshuffle,3、int与number的rle与byte-packet选择：,通过预计算一个代价公式，算出使用编码后的压缩效果，与配置项进行对比。,rle：计算重复权重,byte-packet：计算位宽,4、char、varchar类型的字典编码选择：,先使用字典编码，基数超过一定值进行退化。在compact时看是否还原/slice重复比很低→不用字典。,5、字节数较小是否使用需要测试（tpch char(1)），压缩比与查询字段效率。,6、提供一个接口获取slice meta，其中统计distinct值，如果为字符类型，根据其中distinct值判断是否还原,7、encoder提供一个接口选择编码，在blockwriter层调用；字典编码在coast层提供接口提供统计信息，挂在blockwriter上,Posted by leiyulu at 一月 10, 2024 11:24|
|---|
|  [](null)  ,1、视图显示AUTO需要适配get ddl,2、缓存处理做在encoder层，接口autoencoder,3、字典编码默认使用字典，增加百分比回退，增加函数传入总数，传出百分比,到达4k，数据超过128字节长度进行检查，（数据很长且）重复率不到50%退化,null值单独计算，按数据平均长度计算,char(4)包含以下都不用字典,4、字典index占用内存过多考虑使用线性hash或二层hash,  
,Posted by leiyulu at 一月 16, 2024 11:04|
|  [](null)  ,2024.1.18正式评审：,1、get ddl处理,2、Number注意负值,Posted by leiyulu at 一月 18, 2024 10:25|
