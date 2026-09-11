Created by 林永豪 on 一月 19, 2024

  


SR：    [YDBRD-8443](https://jira.yasdb.com/browse/YDBRD-8443?src=confmacro)    -  filter like优化  完成

##   [1. Overview（概述）](#1-overview概述)  

使用kmp算法加速filter like的匹配。

##   [2. Features（功能特性）](#2-features功能特性)  

使用kmp算法加速filter like的匹配。匹配过程中考虑通配符'%'（任意个字符，0到正无穷）和通配符'_'（1个字符）

##   [3. Interfaces（接口）](#3-interfaces接口)  

无对外暴露接口

内部接口：

- execFilterLikeKmp


##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

- 服务端字符集不为GBK
- like不能带escape
- like模式串的expr类型是const
- like模式串的总长度小于kmp next数组长度（255）


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

####   [满足特定条件时，走like kmp匹配算法](#满足特定条件时走like-kmp匹配算法)  

- 1.记录模式串中每个模式子串的初始位置和长度
    - 比如：'%%123_456',有三个子串，第一个子串初始位置0，长度1('%')；第二个子串初始位置1，长度4('%123')；第三个子串初始位置5，长度4('_456')
- 2.对每个模式子串快速匹配
    - 如果当前已匹配完所有的模式子串，要检查当前文本串是否已匹配完，匹配完true否则false
    - 取当前模式子串，子串打头字符有三种情况：通配符'%'，通配符'_'，其它
        - （1）通配符'_'打头的情况：
            - 首先检查当前文本串是否匹配完了，如果已匹配完要返回false。比如文本串'12'和模式串'_ _ _'（三个下划线）
            - 获取 当前文本串 首个字符的字节数mbLen，然后模式串跳1，文本串跳mbLen
            - 如果模式子串是'_'单独出现的情况，则需要递归匹配下一个模式子串
        - （2）其它字符打头的情况：
            - 如果当前文本串长度小于模式子串长度，返回false，表示文本串匹配不上完整的模式串
            - memcmp快速匹配，比较长度是模式子串长度，比较不相等则返回false；比较相等则文本串跳过模式子串长度
        - （3）通配符'%'打头的情况：
            - 如果模式子串是'%'单独出现的情况，判断'%'是不是出现在模式串的末尾位置，是则返回true。比如文本串'123456'和模式串'123%';
            - 如果模式子串是'%'单独出现的情况，递归匹配下一个模式子串，如果匹配失败的话要回溯回来，再接着往后面找（跳的步长要用mbLen）。中间过程中匹配成功就返回true，否则到最后就得返回false。 比如文本串'12中3456'和模式串'%%345'中的第一个'%'。
            - 考虑模式子串不是'%'单独出现的情况，如'%123123'，则调用kmp算法确认文本串要跳到的与模式子串匹配的位置，让文本串偏移到当前位置与模式子串进行匹配。匹配成功则返回true。如果一直到最后，返回的位置大于文本串长度则返回false。


###   [5.2 Data Structures & Flow（数据结构与流程）](#52-data-structures--flow数据结构与流程)  

```
typedef struct StLikeSubInfo {
    CodUint8 startPos;
    CodUint8 len;
} LikeSubInfo;

typedef struct StLikeKmpInfo {
    CodUint16   envCharset;
    CodUint8    subInfoCount;
    CodUint8    reversed;
    CodUint8    nextArr[COD_KMP_NEXT_LEN];
    LikeSubInfo subInfoArr[COD_KMP_NEXT_LEN];
} LikeKmpInfo;

```

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

- (1)模式串：_和%的交叉串。


```
select * from like_0427_1 where c1 like '%';
select * from like_0427_1 where c1 like '_';
select * from like_0427_1 where c1 like '%%';
select * from like_0427_1 where c1 like '%_';
select * from like_0427_1 where c1 like '_%';
select * from like_0427_1 where c1 like '__';
select * from like_0427_1 where c1 like '%%%';
select * from like_0427_1 where c1 like '%%_';
select * from like_0427_1 where c1 like '%_%';
select * from like_0427_1 where c1 like '%__';
select * from like_0427_1 where c1 like '_%%';
select * from like_0427_1 where c1 like '_%_';
select * from like_0427_1 where c1 like '__%';
select * from like_0427_1 where c1 like '___';
select * from like_0427_1 where c1 like '%_%_%_%';
select * from like_0427_1 where c1 like '_%_%_%_';

```

- (2)模式子串中有重叠子串的情况
- 比如：
- 文本串'456123456123123'
- 模式串'%123123'
- (3)文本串有重叠子串的情况：
- 比如：
- 文本串'12345123456'
- 模式串'%123456'
- (4)检查通配符下划线的匹配情况，一个中文字符也只对应一个下划线
- (5)NULL不与任何通配符匹配
