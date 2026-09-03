Created by 林永豪 on 一月 05, 2024

SR链接：

23.1：    [YDBRD-24796](https://jira.yasdb.com/browse/YDBRD-24796?src=confmacro)    -  超32000长度的CLOB支持like过滤  完成

23.2：    [YDBRD-25030](https://jira.yasdb.com/browse/YDBRD-25030?src=confmacro)    -  超32000长度的CLOB支持like过滤  完成

#   [YDBRD-24796 : 超32000长度的CLOB支持like过滤 Design（超32000长度的CLOB支持like过滤方案设计）](#ydbrd-24796--超32000长度的clob支持like过滤-design超32000长度的clob支持like过滤方案设计)  

##   [1. Overview（概述）](#1-overview概述)  

**需求来源：**

市场需求

**交付形态：**

单机行执行

**需求分析：**

超32000字节长度的CLOB支持like过滤

**历史相关设计文档：**

  [like通用功能支持](https://conf.yasdb.com/pages/viewpage.action?pageId=64821105)  

  [特定场景提速：kmp算法like](https://conf.yasdb.com/display/~linyonghao/kmp+like)  

**CLOB支持like过滤历史情况：**

|形态|小于等于32000字节的clob like|大于32000字节的clob like|
|---|---|---|
|单机行执行|支持|**不支持(这个SR需支持)**|
|单机列执行|支持|不支持|


注：pattern expr在内部处理会隐式转换成字符型，长度不能超过32000字节

##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|clob大于32000字节（使用kmp算法的情况）|正常输出结果|要触发走kmp算法的分支，要同时满足三个条件：（1）服务端字符集不是GBK字符集；（2）当前like不带escape表达式；（3）pattern表达式，转成字符型长度不超过255|
|clob大于32000字节（使用通用办法的情况）|正常输出结果|不走kmp算法分支的都会走通用办法处理|


##   [3. Interfaces（接口）](#3-interfaces接口)  

不提供对外接口

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 只支持单机行执行
- 只支持clob类型


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

不涉及架构变更，在原先like支持规格的基础上，增加对大于32000字节长度的lob的处理分支

###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

数据结构：

```
typedef struct StLikeLobInfo LikeLobInfo;

typedef CodResult (*AllocOutLobLike)(CodPointer owner, CodUint64 size, CodPointer* ptr);
typedef CodVoid (*ReleaseOutLobLike)(CodPointer owner, CodPointer ptr);
typedef CodBool (*ExecOutLobLike)(CodText* lobText, LikeLobInfo* textInfo, CodUint16 charset, CodUint32* trimSize,
                                  FilterResult* filterResult);

typedef struct StLikeLobCallback {
    AllocOutLobLike   allocOutLobLike;     // 分配执行like匹配所需缓冲区的方法
    ReleaseOutLobLike releaseOutLobLike;   // 释放执行like匹配所需缓冲区的方法
    ExecOutLobLike    execOutLobLike;      // 执行like匹配的方法
    CodUint64         batchSize;           // 每次分批进行like匹配时缓冲区的大小
} LikeLobCallback;

typedef struct StLikeLobInfo {
    CodText*        patternText; // pattern expr执行、转换成字符型后的text
    CodText*        escapeText;  // escape expr执行、转换成字符型后的text
    LikeLobCallback callBack;    // 方法回调注册
} LikeLobInfo;


```

流程图：

![](https://pingcode.yasdb.com/atlas/files/public/67396c98a1ad9a3311dc8b8f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQVFBSUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ0FBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFFQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE2NjEsImV4cCI6MTc4MjMxMjQ2MX0.xZlo34qgtxuq39XhCCkt_SpG-FVgGwXsCml4U1Ihvag)

**outrow clob like，kmp算法逻辑：**

- 每次分批进行like匹配时缓冲区的大小设置成64K
- 循环按64K来读取出clob片段，如果clob小于等于64K，则一次读出全clob；否则只读出前64K的clob片段
- 对每次读出的clob，执行之前实现的kmp算法like匹配。如果匹配成功，则直接返回true；匹配不成功则表明当前片段不匹配，需要继续取后面的clob片段进行匹配
- 后续的匹配，每次开始匹配位置的确定：
    - 上次匹配不成功，则这次开始匹配位置规定从  64K减去1K  处开始。【1K的原因：kmp模式串中含有下划线的情况，下划线表示匹配一个字符，一个字符在UTF8中最大四字节。kmp算法最多支持匹配255个下划线，所以最大容错是255*4=1020。近似1K。】
    - 调用TextTrimInvalidChar接口，对 开始匹配位置刚好位于某个字符的中间字节的情况 进行微调。匹配位置向前移动到最后一个合法字符的最后一个字节处。
- 匹配到最后一次，clob片段长度一定小于等于64K，这时如果再匹配失败则最后返回匹配失败。


流程图：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c988970c2af4f520d21/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQVFBSUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ0FBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFFQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE2NjEsImV4cCI6MTc4MjMxMjQ2MX0.xZlo34qgtxuq39XhCCkt_SpG-FVgGwXsCml4U1Ihvag)

**outrow clob like，通用逻辑：**

- 每次分批进行like匹配时缓冲区的大小设置成2M
- 循环按2M来读取出clob片段，如果clob小于等于2M，则一次读出全clob；否则只读出前2M的clob片段
- 对每次读出的clob，执行之前实现的kmp算法like匹配。如果匹配成功，则直接返回true；匹配不成功则表明当前片段不匹配，需要继续取后面的clob片段进行匹配
- 后续的匹配，每次开始匹配位置的确定：
    - 上次匹配不成功，则这次开始匹配位置规定从  2M减去模式串长度乘以当前服务端字符集的最大字符字节（比如UTF8的最大字符字节是4）   处开始。【原因：kmp模式串中含有下划线的情况，下划线表示匹配一个字符，一个字符在UTF8中最大四字节。】
    - 调用TextTrimInvalidChar接口，对 开始匹配位置刚好位于某个字符的中间字节的情况 进行微调。匹配位置向前移动到最后一个合法字符的最后一个字节处。
- 匹配到最后一次，clob片段长度一定小于等于2M，这时如果再匹配失败则最后返回匹配失败。


流程图：

  


![](https://pingcode.yasdb.com/atlas/files/public/67396c98a1ad9a3311dc8b92/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQVFBSUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBZ0FBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFFQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBZ0FBQUFBQUFBQUFBQUFBQUFDQUJBQUFBQUFBQUFBQUFBQUFBQUFBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDE2NjEsImV4cCI6MTc4MjMxMjQ2MX0.xZlo34qgtxuq39XhCCkt_SpG-FVgGwXsCml4U1Ihvag)

###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

暂无

###   [5.4 DFX设计](#54-dfx设计)  

暂无

###   [5.5 其他](#55-其他)  

暂无

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

**维度一：clob的长度**

可分为0 ~ 32000（不在本SR范围，不过也可以取下，确认不影响原有处理），32000 ~ 64K，64K ~ 2M，2M以上，各范围取值，同时也注意考虑边界值

**维度二：pattern的长度**

可分为1 ~ 255字节，255字节 ~ 32000字节，32000字节以上（报错），各范围取值，同时也注意考虑边界值

**维度三：pattern的内容**

可分为 不含通配符、含 百分号 通配符（百分号表示匹配任意个字符）、含 下划线 分配符（下划线表示匹配一个字符）、以及混合情况（通配符可在任意位置，包括但不限于首部、尾部）

**维度四：like是否带有escape表达式**

**维度五：当前系统字符集**

建议在UTF8和GBK的字符集下都执行一遍用例

**维度六：expr的形式**

包括但不限于列、常量、绑定参数。

**以上维度可以混合测试。**

##   [7.资料设计章节](#7资料设计章节)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments: