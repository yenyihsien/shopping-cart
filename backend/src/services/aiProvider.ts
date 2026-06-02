type RecipeSuggestion = {
  recipeName: string;
  steps: string[];
  missingIngredients: string[];
};

type RecipeTemplate = {
  recipeName: string;
  steps: string[];
  requiredIngredients: string[];
  suggestionIngredients: string[];
};

const recipeTemplates: RecipeTemplate[] = [
  {
    recipeName: "羅宋湯",
    steps: [
      "牛肉切塊後先汆燙，去除雜質。",
      "洋蔥與番茄切丁，先炒出香氣。",
      "加入牛肉與清水，中小火燉煮 40 分鐘。",
      "依口味加鹽與黑胡椒，完成暖胃羅宋湯。"
    ],
    requiredIngredients: ["牛肉"],
    suggestionIngredients: ["洋蔥", "番茄", "馬鈴薯"]
  },
  {
    recipeName: "馬鈴薯燉肉",
    steps: [
      "牛肉切塊煎上色，鎖住肉汁。",
      "馬鈴薯切塊後與牛肉拌炒。",
      "加入水蓋過食材，小火慢燉 35 分鐘。",
      "起鍋前調整鹹度即可上桌。"
    ],
    requiredIngredients: ["牛肉"],
    suggestionIngredients: ["馬鈴薯", "洋蔥"]
  },
  {
    recipeName: "番茄義大利麵",
    steps: [
      "洋蔥切丁先炒香，加入番茄拌炒至出汁。",
      "加入少量水與鹽，煮成基底醬汁。",
      "義大利麵煮至八分熟後放入醬汁收乾。",
      "盛盤後可灑上黑胡椒提升香氣。"
    ],
    requiredIngredients: ["義大利麵"],
    suggestionIngredients: ["番茄", "洋蔥"]
  },
  {
    recipeName: "牛肉清炒義大利麵",
    steps: [
      "牛肉切薄片後先快速煎上色。",
      "義大利麵煮熟瀝乾，保留少許煮麵水。",
      "牛肉與麵條拌炒，加入煮麵水與鹽調味。",
      "起鍋前加入洋蔥絲可增加層次。"
    ],
    requiredIngredients: ["牛肉"],
    suggestionIngredients: ["義大利麵", "洋蔥"]
  },
  {
    recipeName: "番茄馬鈴薯蔬菜湯",
    steps: [
      "番茄、馬鈴薯、洋蔥切塊備用。",
      "先炒洋蔥後加入番茄煮出湯底。",
      "加入馬鈴薯與清水煮至軟化。",
      "加鹽與香草即可完成清爽蔬菜湯。"
    ],
    requiredIngredients: ["番茄"],
    suggestionIngredients: ["馬鈴薯", "洋蔥"]
  },
  {
    recipeName: "健康綜合蔬食碗",
    steps: [
      "把現有食材切成適口大小。",
      "先汆燙再快炒，保留營養與口感。",
      "加入少量橄欖油與鹽調味。",
      "搭配主食即可完成均衡一餐。"
    ],
    requiredIngredients: [],
    suggestionIngredients: ["番茄", "洋蔥", "義大利麵"]
  }
];

export const getRecipeSuggestions = (ingredientNames: string[]): RecipeSuggestion[] => {
  const basket = new Set(ingredientNames);

  const matched = recipeTemplates
    .filter((template) => template.requiredIngredients.every((name) => basket.has(name)))
    .map((template) => ({
      recipeName: template.recipeName,
      steps: template.steps,
      missingIngredients: template.suggestionIngredients.filter((name) => !basket.has(name))
    }))
    .filter((recipe) => recipe.missingIngredients.length > 0);

  return matched.slice(0, 4);
};
